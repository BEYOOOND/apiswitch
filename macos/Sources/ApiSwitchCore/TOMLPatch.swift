import Foundation

public enum TOMLPatch {
  public static func upsertModelProvider(
    source: String,
    providerId: String,
    name: String,
    baseURL: String,
    apiKey: String,
    model: String?
  ) -> String {
    var text = source
    text = setTopLevelString(text, key: "model_provider", value: providerId)
    text = setTopLevelString(text, key: "openai_base_url", value: baseURL)
    if let model, !model.isEmpty {
      text = setTopLevelString(text, key: "model", value: model)
    }

    let header = "[model_providers.\(providerId)]"
    let block = """
    \(header)
    name = "\(escapeToml(name))"
    base_url = "\(escapeToml(baseURL))"
    wire_api = "responses"
    requires_openai_auth = false
    supports_websockets = false
    env_key = "OPENAI_API_KEY"
    experimental_bearer_token = "\(escapeToml(apiKey))"

    """

    if let range = findTableRange(text, header: header) {
      let start = text.index(text.startIndex, offsetBy: range.0)
      let end = text.index(text.startIndex, offsetBy: range.1)
      text.replaceSubrange(start..<end, with: block + "\n")
    } else {
      if !text.isEmpty, !text.hasSuffix("\n") { text += "\n" }
      if !text.isEmpty, !text.hasSuffix("\n\n") { text += "\n" }
      text += block
      if !text.hasSuffix("\n") { text += "\n" }
    }
    return text
  }

  public static func clearRelayOverrides(_ source: String) -> String {
    var text = removeTopLevelKey(source, key: "model_provider")
    text = removeTopLevelKey(text, key: "openai_base_url")
    return text
  }

  private static func escapeToml(_ s: String) -> String {
    s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
  }

  private static func setTopLevelString(_ source: String, key: String, value: String) -> String {
    let line = "\(key) = \"\(escapeToml(value))\""
    let pattern = try! NSRegularExpression(pattern: "^\(NSRegularExpression.escapedPattern(for: key))\\s*=\\s*.*$", options: .anchorsMatchLines)
    let range = NSRange(source.startIndex..<source.endIndex, in: source)
    if pattern.firstMatch(in: source, options: [], range: range) != nil {
      return pattern.stringByReplacingMatches(in: source, options: [], range: range, withTemplate: NSRegularExpression.escapedTemplate(for: line))
    }
    if source.isEmpty { return line + "\n" }
    var text = source
    if !text.hasSuffix("\n") { text += "\n" }
    return line + "\n" + text
  }

  private static func removeTopLevelKey(_ source: String, key: String) -> String {
    let pattern = try! NSRegularExpression(
      pattern: "^\(NSRegularExpression.escapedPattern(for: key))\\s*=\\s*.*\\n?",
      options: .anchorsMatchLines
    )
    let range = NSRange(source.startIndex..<source.endIndex, in: source)
    return pattern.stringByReplacingMatches(in: source, options: [], range: range, withTemplate: "")
  }

  private static func findTableRange(_ text: String, header: String) -> (Int, Int)? {
    guard let startRange = text.range(of: header) else { return nil }
    let start = text.distance(from: text.startIndex, to: startRange.lowerBound)
    var idx = text.index(startRange.lowerBound, offsetBy: header.count)
    while idx < text.endIndex {
      if text[idx] == "\n" {
        let next = text.index(after: idx)
        if next < text.endIndex, text[next] == "[" {
          return (start, text.distance(from: text.startIndex, to: next))
        }
      }
      idx = text.index(after: idx)
    }
    return (start, text.count)
  }
}
