import Foundation

public struct SwitchResult: Sendable {
  public var profile: Profile?
  public var restored: Bool
  public var targets: [String]

  public init(profile: Profile?, restored: Bool, targets: [String]) {
    self.profile = profile
    self.restored = restored
    self.targets = targets
  }
}

public final class Switcher {
  public enum SwitchError: Error, LocalizedError {
    case message(String)
    public var errorDescription: String? {
      if case .message(let m) = self { return m }
      return nil
    }
  }

  public let store: ProfileStore

  public init(store: ProfileStore = ProfileStore()) {
    self.store = store
  }

  public func switchTo(id: String) throws -> SwitchResult {
    let profile = store.load().profiles.first { $0.id == id }
    guard let profile else { throw SwitchError.message("profile not found: \(id)") }
    return try apply(profile: profile, setActive: true)
  }

  public func apply(profile: Profile, setActive: Bool = true) throws -> SwitchResult {
    let hydrated = store.hydrateSecrets(profile)
    let targets = ["codex"]
    Paths.backup([Paths.codexAuth, Paths.codexConfig])
    let creds = CredentialResolver.resolve(profile: hydrated, target: "codex", keychain: store.keychain)
    try CodexWriter.apply(profile: hydrated, credentials: creds)
    if setActive {
      _ = try store.setActiveForTargets(id: hydrated.id, targets: targets)
    }
    return SwitchResult(profile: hydrated, restored: false, targets: targets)
  }

  public func restoreOfficial() throws -> SwitchResult {
    let ids = ["codex"]
    Paths.backup([Paths.codexAuth, Paths.codexConfig])
    try CodexWriter.clear()
    _ = store.clearActiveForTargets(ids)
    return SwitchResult(profile: nil, restored: true, targets: ids)
  }
}
