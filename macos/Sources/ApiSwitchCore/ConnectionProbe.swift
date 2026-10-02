import Foundation

public struct ProbeResult: Equatable, Sendable {
  public var ok: Bool
  public var endpoint: String
  public var statusCode: Int?
  public var latencyMs: Int
  public var message: String

  public init(ok: Bool, endpoint: String, statusCode: Int?, latencyMs: Int, message: String) {
    self.ok = ok
    self.endpoint = endpoint
    self.statusCode = statusCode
    self.latencyMs = latencyMs
    self.message = message
  }

  public var summary: String {
    let code = statusCode.map(String.init) ?? "-"
    let state = ok ? "OK" : "FAIL"
    return "[\(state)] HTTP \(code)  \(latencyMs)ms\n\(endpoint)\n\(message)"
  }
}

public enum ConnectionProbe {
  public static func probeProfile(
    _ profile: Profile,
    keychain: KeychainStore = .shared,
    timeoutMs: Int = 12000
  ) async -> ProbeResult {
    let creds = CredentialResolver.resolveForProbe(profile: profile, keychain: keychain)
    return await probe(baseURL: creds.baseURL, apiKey: creds.apiKey, timeoutMs: timeoutMs)
  }

  public static func probe(baseURL: String, apiKey: String, timeoutMs: Int = 12000) async -> ProbeResult {
    let trimmedURL = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedKey = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmedURL.isEmpty {
      return ProbeResult(ok: false, endpoint: "", statusCode: nil, latencyMs: 0, message: "Base URL 为空")
    }
    if trimmedKey.isEmpty {
      return ProbeResult(ok: false, endpoint: trimmedURL, statusCode: nil, latencyMs: 0, message: "API Key 为空")
    }

    var last: ProbeResult?
    for urlString in candidateURLs(trimmedURL) {
      let headerSets: [[String: String]] = [
        ["Authorization": "Bearer \(trimmedKey)", "Content-Type": "application/json"],
        [
          "x-api-key": trimmedKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        ]
      ]
      for headers in headerSets {
        let result = await request(urlString, headers: headers, timeoutMs: timeoutMs)
        if result.ok { return result }
        last = result
        if result.statusCode == 401 || result.statusCode == 403 { return result }
      }
    }
    return last ?? ProbeResult(
      ok: false,
      endpoint: trimmedURL,
      statusCode: nil,
      latencyMs: 0,
      message: "没有可用的探测地址"
    )
  }

  private static func candidateURLs(_ base: String) -> [String] {
    var b = base
    while b.hasSuffix("/") { b.removeLast() }
    var urls = ["\(b)/models"]
    if let u = URL(string: b) {
      let path = u.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
      if !path.hasSuffix("v1") { urls.append("\(b)/v1/models") }
    } else {
      urls.append("\(b)/v1/models")
    }
    return Array(Set(urls))
  }

  private static func request(
    _ urlString: String,
    headers: [String: String],
    timeoutMs: Int
  ) async -> ProbeResult {
    guard let url = URL(string: urlString) else {
      return ProbeResult(ok: false, endpoint: urlString, statusCode: nil, latencyMs: 0, message: "无效 URL")
    }
    var req = URLRequest(url: url, timeoutInterval: TimeInterval(timeoutMs) / 1000.0)
    req.httpMethod = "GET"
    for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }

    let started = Date()
    do {
      let (data, response) = try await URLSession.shared.data(for: req)
      let ms = Int(Date().timeIntervalSince(started) * 1000)
      let http = response as? HTTPURLResponse
      let status = http?.statusCode
      let bodyText = String(data: data.prefix(2048), encoding: .utf8) ?? ""
      if let status, (200..<300).contains(status) {
        var detail = "连接成功"
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let arr = obj["data"] as? [Any]
        {
          detail = "连接成功，models≈\(arr.count)"
        } else if !bodyText.isEmpty {
          detail = "连接成功：\(shortBody(bodyText))"
        }
        return ProbeResult(ok: true, endpoint: urlString, statusCode: status, latencyMs: ms, message: detail)
      }
      return ProbeResult(
        ok: false,
        endpoint: urlString,
        statusCode: status,
        latencyMs: ms,
        message: shortBody(bodyText).isEmpty ? "HTTP \(status ?? 0)" : shortBody(bodyText)
      )
    } catch {
      return ProbeResult(
        ok: false,
        endpoint: urlString,
        statusCode: nil,
        latencyMs: 0,
        message: "网络错误: \(error.localizedDescription)"
      )
    }
  }

  private static func shortBody(_ body: String) -> String {
    let text = body.replacingOccurrences(of: "\n", with: " ")
    if text.count > 160 { return String(text.prefix(157)) + "..." }
    return text
  }
}
