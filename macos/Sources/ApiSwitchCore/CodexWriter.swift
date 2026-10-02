import Foundation

public enum CodexWriter {
  public static func apply(profile: Profile, credentials: ResolvedCredentials) throws {
    writeAuth(apiKey: credentials.apiKey)
    writeConfig(profile: profile, credentials: credentials)
    writeBearerFile(apiKey: credentials.apiKey)
    SessionEnv.set([
      "OPENAI_API_KEY": credentials.apiKey,
      "CODEX_API_KEY": credentials.apiKey,
      "OPENAI_BASE_URL": credentials.baseURL
    ])
  }

  public static func clear() throws {
    clearAuth()
    if FileManager.default.fileExists(atPath: Paths.codexConfig) {
      clearConfig()
    }
    try? FileManager.default.removeItem(atPath: Paths.bearerTokenFile)
    SessionEnv.unset(SessionEnv.codexKeys)
  }

  public static func writeBearerFile(apiKey: String) {
    Paths.ensureDir(Paths.apiswitchDir)
    Paths.atomicWrite(Paths.bearerTokenFile, content: apiKey + "\n")
  }

  private static func loadJSONObject(_ filePath: String) -> [String: Any] {
    guard let raw = ProfileJSON.parseJSONFile(filePath) as? [String: Any] else { return [:] }
    return raw
  }

  private static func writeJSONObject(_ dict: [String: Any], filePath: String) {
    if let data = try? JSONSerialization.data(withJSONObject: dict, options: [.prettyPrinted, .sortedKeys]),
       let text = String(data: data, encoding: .utf8)
    {
      Paths.atomicWrite(filePath, content: text + "\n")
    }
  }

  private static func writeAuth(apiKey: String) {
    Paths.ensureDir(Paths.codexDir)
    var auth = loadJSONObject(Paths.codexAuth)
    if auth["tokens"] != nil {
      var backup: [String: Any] = [
        "tokens": auth["tokens"] as Any,
        "saved_at": ISO8601DateFormatter().string(from: Date())
      ]
      if let lr = auth["last_refresh"] { backup["last_refresh"] = lr }
      writeJSONObject(backup, filePath: Paths.chatgptTokensBackup)
      auth.removeValue(forKey: "tokens")
      auth.removeValue(forKey: "last_refresh")
    }
    auth["OPENAI_API_KEY"] = apiKey
    auth["auth_mode"] = "api_key"
    writeJSONObject(auth, filePath: Paths.codexAuth)
  }

  private static func clearAuth() {
    var auth = loadJSONObject(Paths.codexAuth)
    auth["OPENAI_API_KEY"] = NSNull()
    if FileManager.default.fileExists(atPath: Paths.chatgptTokensBackup) {
      let backup = loadJSONObject(Paths.chatgptTokensBackup)
      if let tokens = backup["tokens"] { auth["tokens"] = tokens }
      if let lr = backup["last_refresh"] { auth["last_refresh"] = lr }
      auth["auth_mode"] = "chatgpt"
    } else if auth["tokens"] != nil {
      auth["auth_mode"] = "chatgpt"
    } else if auth["auth_mode"] as? String == "api_key" {
      auth.removeValue(forKey: "auth_mode")
    }
    writeJSONObject(auth, filePath: Paths.codexAuth)
  }

  private static func writeConfig(profile: Profile, credentials: ResolvedCredentials) {
    Paths.ensureDir(Paths.codexDir)
    let providerId = ProfileHelpers.resolvedProviderId(profile.codex.providerId, profileId: profile.id)
    let existing =
      (try? String(contentsOfFile: Paths.codexConfig, encoding: .utf8)) ?? ""
    let model = profile.codex.model.isEmpty ? nil : profile.codex.model
    let updated = TOMLPatch.upsertModelProvider(
      source: existing,
      providerId: providerId,
      name: profile.name,
      baseURL: credentials.baseURL,
      apiKey: credentials.apiKey,
      model: model
    )
    Paths.atomicWrite(Paths.codexConfig, content: updated)
  }

  private static func clearConfig() {
    guard FileManager.default.fileExists(atPath: Paths.codexConfig),
          let existing = try? String(contentsOfFile: Paths.codexConfig, encoding: .utf8)
    else { return }
    Paths.atomicWrite(Paths.codexConfig, content: TOMLPatch.clearRelayOverrides(existing))
  }
}
