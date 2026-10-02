import Foundation

public struct ResolvedCredentials: Equatable, Sendable {
  public var baseURL: String
  public var apiKey: String

  public init(baseURL: String, apiKey: String) {
    self.baseURL = baseURL
    self.apiKey = apiKey
  }
}

public enum CredentialResolver {
  public static func resolve(
    profile: Profile,
    target: String,
    keychain: KeychainStore
  ) -> ResolvedCredentials {
    let override = profile.overrides[target]
    let baseFromOverride = override?.baseURL.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let base = baseFromOverride.isEmpty ? profile.baseURL : baseFromOverride

    if let plain = override?.apiKey.trimmingCharacters(in: .whitespacesAndNewlines), !plain.isEmpty {
      return ResolvedCredentials(baseURL: base, apiKey: plain)
    }
    if let ref = override?.apiKeyRef, let key = keychain.load(ref: ref) {
      return ResolvedCredentials(baseURL: base, apiKey: key)
    }
    if !profile.apiKeyRef.isEmpty, let key = keychain.load(ref: profile.apiKeyRef) {
      return ResolvedCredentials(baseURL: base, apiKey: key)
    }
    return ResolvedCredentials(
      baseURL: base,
      apiKey: profile.apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
    )
  }

  public static func resolveForProbe(profile: Profile, keychain: KeychainStore) -> ResolvedCredentials {
    if !profile.apiKeyRef.isEmpty, let key = keychain.load(ref: profile.apiKeyRef) {
      return ResolvedCredentials(baseURL: profile.baseURL, apiKey: key)
    }
    return ResolvedCredentials(baseURL: profile.baseURL, apiKey: profile.apiKey)
  }
}
