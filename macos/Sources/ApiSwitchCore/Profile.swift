import Foundation

public let currentSchemaVersion = 6

public struct CodexOptions: Equatable, Sendable {
  public var providerId: String
  public var model: String

  public init(providerId: String = "", model: String = "") {
    self.providerId = providerId
    self.model = model
  }
}

public struct ToolOverride: Equatable, Sendable {
  public var baseURL: String
  public var apiKey: String
  public var apiKeyRef: String

  public init(baseURL: String = "", apiKey: String = "", apiKeyRef: String = "") {
    self.baseURL = baseURL
    self.apiKey = apiKey
    self.apiKeyRef = apiKeyRef
  }
}

public struct Profile: Identifiable, Equatable, Sendable {
  public var id: String
  public var name: String
  public var baseURL: String
  public var apiKey: String
  public var apiKeyRef: String
  public var targets: [String]
  public var codex: CodexOptions
  public var overrides: [String: ToolOverride]

  public init(
    id: String,
    name: String,
    baseURL: String = "",
    apiKey: String = "",
    apiKeyRef: String = "",
    targets: [String] = ["codex"],
    codex: CodexOptions = CodexOptions(),
    overrides: [String: ToolOverride] = [:]
  ) {
    self.id = id
    self.name = name
    self.baseURL = ProfileHelpers.normalizeBaseURL(baseURL)
    self.apiKey = apiKey
    self.apiKeyRef = apiKeyRef
    self.targets = targets.isEmpty ? ["codex"] : targets
    self.codex = codex
    self.overrides = overrides
  }
}

public struct StoreData: Equatable, Sendable {
  public var schemaVersion: Int
  public var active: String?
  public var lastRelayId: String?
  public var activeByTarget: [String: String]
  public var profiles: [Profile]

  public init(
    schemaVersion: Int = currentSchemaVersion,
    active: String? = nil,
    lastRelayId: String? = nil,
    activeByTarget: [String: String] = [:],
    profiles: [Profile] = []
  ) {
    self.schemaVersion = schemaVersion
    self.active = active
    self.lastRelayId = lastRelayId
    self.activeByTarget = activeByTarget
    self.profiles = profiles
  }

  public static func empty() -> StoreData { StoreData() }
}

public enum ProfileHelpers {
  public static func normalizeBaseURL(_ u: String) -> String {
    var s = u.trimmingCharacters(in: .whitespacesAndNewlines)
    while s.hasSuffix("/") { s.removeLast() }
    return s
  }

  public static func resolvedProviderId(_ providerId: String, profileId: String) -> String {
    let trimmed = providerId.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmed.isEmpty { return trimmed }
    return profileId.replacingOccurrences(of: "-", with: "_")
  }

  public static func maskKey(_ key: String) -> String {
    if key.isEmpty { return "(empty)" }
    if key.count <= 8 { return String(repeating: "*", count: key.count) }
    let start = key.prefix(3)
    let end = key.suffix(4)
    return "\(start)…\(end)"
  }

  public static func slugify(_ name: String) -> String {
    let lower = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    var s = ""
    for ch in lower {
      if ch.isLetter || ch.isNumber { s.append(ch) } else { s.append("_") }
    }
    while s.contains("__") { s = s.replacingOccurrences(of: "__", with: "_") }
    s = s.trimmingCharacters(in: CharacterSet(charactersIn: "_"))
    return s.isEmpty ? "profile" : s
  }

  public static func keychainRef(_ profileId: String, target: String? = nil) -> String {
    if let target { return "keychain:\(profileId):\(target)" }
    return "keychain:\(profileId)"
  }

  public static func createProfile(
    id: String,
    name: String,
    baseURL: String = "",
    apiKey: String = "",
    apiKeyRef: String = "",
    codex: CodexOptions = CodexOptions(),
    overrides: [String: ToolOverride] = [:]
  ) -> Profile {
    Profile(
      id: id,
      name: name,
      baseURL: baseURL,
      apiKey: apiKey,
      apiKeyRef: apiKeyRef,
      targets: ["codex"],
      codex: codex,
      overrides: overrides
    )
  }
}

public enum ProfileJSON {
  private static func asString(_ v: Any?) -> String {
    if v == nil || v is NSNull { return "" }
    if let s = v as? String { return s }
    if let n = v as? NSNumber { return n.stringValue }
    return String(describing: v!)
  }

  private static func stripNullActive(_ v: Any?) -> String? {
    let s = asString(v)
    let bad: Set = ["", "null", "none", "official"]
    if bad.contains(s) { return nil }
    return s
  }

  public static func parseStore(_ raw: Any) -> StoreData {
    let obj = raw as? [String: Any] ?? [:]
    var schemaVersion = obj["schema_version"] as? Int ?? 1
    let profilesRaw = obj["profiles"] as? [Any] ?? []
    let profiles = profilesRaw.map { parseProfile($0) }

    var active = stripNullActive(obj["active"])
    if let a = active, !profiles.contains(where: { $0.id == a }) { active = nil }

    var lastRelayId = stripNullActive(obj["last_relay_id"])
    if let l = lastRelayId, !profiles.contains(where: { $0.id == l }) { lastRelayId = nil }
    if lastRelayId == nil { lastRelayId = active }

    let rawMap = obj["active_by_target"] as? [String: String] ?? [:]
    var activeByTarget: [String: String] = [:]
    if let codexActive = rawMap["codex"], profiles.contains(where: { $0.id == codexActive }) {
      activeByTarget["codex"] = codexActive
    } else if let active {
      activeByTarget["codex"] = active
    }

    if schemaVersion < currentSchemaVersion { schemaVersion = currentSchemaVersion }
    return StoreData(
      schemaVersion: schemaVersion,
      active: active,
      lastRelayId: lastRelayId,
      activeByTarget: activeByTarget,
      profiles: profiles
    )
  }

  public static func parseProfile(_ raw: Any) -> Profile {
    let o = raw as? [String: Any] ?? [:]
    let id = asString(o["id"]).isEmpty ? "profile" : asString(o["id"])
    let codexRaw = o["codex"] as? [String: Any] ?? [:]
    let overridesRaw = o["overrides"] as? [String: Any] ?? [:]
    var overrides: [String: ToolOverride] = [:]
    for (k, v) in overridesRaw {
      guard k == "codex" else { continue }
      let ov = v as? [String: Any] ?? [:]
      overrides[k] = ToolOverride(
        baseURL: asString(ov["base_url"]),
        apiKey: asString(ov["api_key"]),
        apiKeyRef: asString(ov["api_key_ref"])
      )
    }
    return ProfileHelpers.createProfile(
      id: id,
      name: asString(o["name"]).isEmpty ? id : asString(o["name"]),
      baseURL: asString(o["base_url"]),
      apiKey: asString(o["api_key"]),
      apiKeyRef: asString(o["api_key_ref"]),
      codex: CodexOptions(
        providerId: asString(codexRaw["provider_id"]),
        model: asString(codexRaw["model"])
      ),
      overrides: overrides
    )
  }

  public static func serializeStore(_ data: StoreData) -> [String: Any] {
    [
      "schema_version": currentSchemaVersion,
      "active": data.active as Any,
      "last_relay_id": data.lastRelayId as Any,
      "active_by_target": data.activeByTarget,
      "profiles": data.profiles.map { serializeProfile($0) }
    ]
  }

  public static func serializeProfile(_ p: Profile) -> [String: Any] {
    var overrides: [String: Any] = [:]
    for (k, v) in p.overrides where k == "codex" {
      overrides[k] = [
        "base_url": v.baseURL,
        "api_key": v.apiKey,
        "api_key_ref": v.apiKeyRef
      ]
    }
    return [
      "id": p.id,
      "name": p.name,
      "base_url": p.baseURL,
      "api_key": p.apiKey,
      "api_key_ref": p.apiKeyRef,
      "targets": ["codex"],
      "codex": ["provider_id": p.codex.providerId, "model": p.codex.model],
      "overrides": overrides
    ]
  }

  public static func jsonData(_ object: Any) throws -> Data {
    try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
  }

  public static func parseJSONFile(_ path: String) -> Any? {
    guard let data = try? Data(contentsOf: URL(fileURLWithPath: path)) else { return nil }
    return try? JSONSerialization.jsonObject(with: data)
  }
}
