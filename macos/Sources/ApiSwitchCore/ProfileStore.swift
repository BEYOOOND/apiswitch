import Foundation

public final class ProfileStore {
  public enum StoreError: Error, LocalizedError {
    case profileNotFound(String)
    case invalidImport(String)

    public var errorDescription: String? {
      switch self {
      case .profileNotFound(let id): return "profile not found: \(id)"
      case .invalidImport(let msg): return "invalid import: \(msg)"
      }
    }
  }

  private let path: String
  public let keychain: KeychainStore
  private var cache: StoreData?

  public init(filePath: String = Paths.profiles, keychain: KeychainStore = .shared) {
    self.path = filePath
    self.keychain = keychain
    Paths.ensureDir(Paths.apiswitchDir)
  }

  public func load(forceReload: Bool = false) -> StoreData {
    if forceReload || cache == nil {
      cache = readFromDisk()
    }
    return hydratedClone(cache!)
  }

  public func invalidate() { cache = nil }

  private func readFromDisk() -> StoreData {
    guard FileManager.default.fileExists(atPath: path),
          let raw = ProfileJSON.parseJSONFile(path)
    else { return .empty() }
    return ProfileJSON.parseStore(raw)
  }

  private func hydratedClone(_ data: StoreData) -> StoreData {
    var copy = data
    copy.profiles = data.profiles.map { hydrateSecrets($0) }
    copy.activeByTarget = data.activeByTarget
    return copy
  }

  @discardableResult
  private func commit() -> StoreData {
    let data = cache ?? .empty()
    saveToDisk(data)
    return hydratedClone(data)
  }

  private func saveToDisk(_ data: StoreData) {
    var out = data
    out.schemaVersion = currentSchemaVersion
    out.profiles = data.profiles.map { persistSecrets($0) }
    cache = out
    let obj = ProfileJSON.serializeStore(out)
    if let json = try? ProfileJSON.jsonData(obj),
       let text = String(data: json, encoding: .utf8)
    {
      Paths.atomicWrite(path, content: text + "\n")
    }
  }

  public func hydrateSecrets(_ profile: Profile) -> Profile {
    var p = profile
    if p.apiKey.isEmpty, !p.apiKeyRef.isEmpty, let key = keychain.load(ref: p.apiKeyRef) {
      p.apiKey = key
    } else if p.apiKey.isEmpty, p.apiKeyRef.isEmpty {
      let ref = ProfileHelpers.keychainRef(p.id)
      if let key = keychain.load(ref: ref) {
        p.apiKey = key
        p.apiKeyRef = ref
      }
    }
    for (target, ov) in p.overrides {
      var o = ov
      if o.apiKey.isEmpty, !o.apiKeyRef.isEmpty, let key = keychain.load(ref: o.apiKeyRef) {
        o.apiKey = key
      }
      p.overrides[target] = o
    }
    return p
  }

  public func persistSecrets(_ profile: Profile) -> Profile {
    var p = profile
    let ref = p.apiKeyRef.isEmpty ? ProfileHelpers.keychainRef(p.id) : p.apiKeyRef
    let plain = p.apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
    if !plain.isEmpty {
      _ = keychain.save(ref: ref, secret: plain)
      p.apiKeyRef = ref
      p.apiKey = ""
    }
    var overrides: [String: ToolOverride] = [:]
    for (target, ov) in p.overrides {
      var o = ov
      let oPlain = o.apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
      if !oPlain.isEmpty {
        let oRef = o.apiKeyRef.isEmpty ? ProfileHelpers.keychainRef(p.id, target: target) : o.apiKeyRef
        _ = keychain.save(ref: oRef, secret: oPlain)
        o.apiKeyRef = oRef
        o.apiKey = ""
      }
      let hasURL = !o.baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      if hasURL || !o.apiKeyRef.isEmpty || !o.apiKey.isEmpty {
        overrides[target] = o
      }
    }
    p.overrides = overrides
    return p
  }

  public func uniqueId(name: String, data: StoreData? = nil) -> String {
    let current = data ?? load()
    let base = ProfileHelpers.slugify(name)
    var candidate = base
    var n = 2
    let existing = Set(current.profiles.map(\.id))
    while existing.contains(candidate) {
      candidate = "\(base)_\(n)"
      n += 1
    }
    return candidate
  }

  @discardableResult
  public func upsert(_ profile: Profile) -> StoreData {
    if cache == nil { cache = readFromDisk() }
    var data = cache!
    if let idx = data.profiles.firstIndex(where: { $0.id == profile.id }) {
      data.profiles[idx] = profile
    } else {
      data.profiles.append(profile)
    }
    cache = data
    return commit()
  }

  @discardableResult
  public func delete(id: String) -> StoreData {
    if cache == nil { cache = readFromDisk() }
    var data = cache!
    if let profile = data.profiles.first(where: { $0.id == id }) {
      _ = keychain.delete(ref: profile.apiKeyRef.isEmpty ? ProfileHelpers.keychainRef(id) : profile.apiKeyRef)
      for (target, ov) in profile.overrides {
        let ref = ov.apiKeyRef.isEmpty ? ProfileHelpers.keychainRef(id, target: target) : ov.apiKeyRef
        _ = keychain.delete(ref: ref)
      }
    }
    data.profiles.removeAll { $0.id == id }
    if data.active == id { data.active = nil }
    data.activeByTarget = data.activeByTarget.filter { $0.value != id }
    if data.active == nil, let first = data.activeByTarget.values.first {
      data.active = first
    }
    cache = data
    return commit()
  }

  @discardableResult
  public func setActiveForTargets(id: String, targets: [String]) throws -> StoreData {
    if cache == nil { cache = readFromDisk() }
    var data = cache!
    guard data.profiles.contains(where: { $0.id == id }) else {
      throw StoreError.profileNotFound(id)
    }
    data.active = id
    data.lastRelayId = id
    for t in targets where t == "codex" {
      data.activeByTarget[t] = id
    }
    cache = data
    return commit()
  }

  @discardableResult
  public func clearActiveForTargets(_ targets: [String]) -> StoreData {
    if cache == nil { cache = readFromDisk() }
    var data = cache!
    for t in targets { data.activeByTarget.removeValue(forKey: t) }
    if data.activeByTarget.isEmpty {
      data.active = nil
    } else if let active = data.active, !data.activeByTarget.values.contains(active) {
      data.active = data.activeByTarget.values.first
    }
    cache = data
    return commit()
  }

  public func duplicate(id: String) throws -> Profile {
    if cache == nil { cache = readFromDisk() }
    let data = cache!
    guard let source = data.profiles.first(where: { $0.id == id }) else {
      throw StoreError.profileNotFound(id)
    }
    let hydrated = hydrateSecrets(source)
    let newId = uniqueId(name: source.name + " copy", data: hydratedClone(data))
    var copy = hydrated
    copy.id = newId
    copy.name = source.name + " Copy"
    if copy.codex.providerId == source.id || copy.codex.providerId.isEmpty {
      copy.codex.providerId = ""
    }
    copy.apiKeyRef = ""
    for t in copy.overrides.keys {
      copy.overrides[t]?.apiKeyRef = ""
    }
    _ = upsert(copy)
    return hydrateSecrets(copy)
  }

  public func exportJSON(redactSecrets: Bool) throws -> Data {
    var data = load()
    if redactSecrets {
      data.active = nil
      data.profiles = data.profiles.map { p in
        var c = p
        c.apiKey = ""
        c.apiKeyRef = ""
        for k in c.overrides.keys {
          c.overrides[k]?.apiKey = ""
          c.overrides[k]?.apiKeyRef = ""
        }
        return c
      }
    }
    return try ProfileJSON.jsonData(ProfileJSON.serializeStore(data))
  }

  @discardableResult
  public func importJSON(_ raw: Data, replace: Bool) throws -> StoreData {
    let incoming: StoreData
    do {
      let parsed = try JSONSerialization.jsonObject(with: raw)
      if let arr = parsed as? [Any] {
        incoming = StoreData(profiles: arr.map { ProfileJSON.parseProfile($0) })
      } else if let obj = parsed as? [String: Any], obj["id"] != nil, obj["profiles"] == nil {
        incoming = StoreData(profiles: [ProfileJSON.parseProfile(obj)])
      } else {
        incoming = ProfileJSON.parseStore(parsed)
      }
    } catch {
      throw StoreError.invalidImport(error.localizedDescription)
    }

    if replace || cache == nil {
      cache = replace ? .empty() : readFromDisk()
    }
    var data = cache!
    for var p in incoming.profiles {
      if data.profiles.contains(where: { $0.id == p.id }) {
        p.id = uniqueId(name: p.name, data: hydratedClone(data))
      }
      if let idx = data.profiles.firstIndex(where: { $0.id == p.id }) {
        data.profiles[idx] = p
      } else {
        data.profiles.append(p)
      }
    }
    if !replace, let active = incoming.active, data.profiles.contains(where: { $0.id == active }) {
      data.active = active
    }
    cache = data
    return commit()
  }
}
