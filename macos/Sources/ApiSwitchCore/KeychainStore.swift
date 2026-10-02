import Foundation
import Security

public final class KeychainStore: @unchecked Sendable {
  public static let shared = KeychainStore()

  public let service: String
  private var memory: [String: String] = [:]
  private var useFileFallback = false
  private let lock = NSLock()

  public init(service: String = "com.vincentz.apiswitch") {
    self.service = service
  }

  public func enableFileFallback(_ enabled: Bool = true) {
    lock.lock(); defer { lock.unlock() }
    useFileFallback = enabled
  }

  public func accountFromRef(_ ref: String) -> String? {
    let trimmed = ref.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.hasPrefix("keychain:") else { return nil }
    let account = String(trimmed.dropFirst("keychain:".count))
    return account.isEmpty ? nil : account
  }

  @discardableResult
  public func save(ref: String, secret: String) -> Bool {
    guard let account = accountFromRef(ref) else { return false }
    return saveAccount(account, secret: secret)
  }

  @discardableResult
  public func saveAccount(_ account: String, secret: String) -> Bool {
    lock.lock(); defer { lock.unlock() }
    if useFileFallback {
      memory[account] = secret
      persistFallbackUnlocked()
      return true
    }
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account
    ]
    SecItemDelete(query as CFDictionary)
    var add = query
    add[kSecValueData as String] = Data(secret.utf8)
    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    let status = SecItemAdd(add as CFDictionary, nil)
    if status == errSecSuccess {
      memory[account] = secret
      return true
    }
    useFileFallback = true
    memory[account] = secret
    persistFallbackUnlocked()
    return true
  }

  public func load(ref: String) -> String? {
    guard let account = accountFromRef(ref) else { return nil }
    return loadAccount(account)
  }

  public func loadAccount(_ account: String) -> String? {
    lock.lock(); defer { lock.unlock() }
    if let cached = memory[account] { return cached }
    if useFileFallback {
      loadFallbackUnlocked()
      return memory[account]
    }
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecSuccess, let data = item as? Data, let s = String(data: data, encoding: .utf8) {
      memory[account] = s
      return s
    }
    loadFallbackUnlocked()
    return memory[account]
  }

  @discardableResult
  public func delete(ref: String) -> Bool {
    guard let account = accountFromRef(ref) else { return false }
    lock.lock(); defer { lock.unlock() }
    memory.removeValue(forKey: account)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account
    ]
    SecItemDelete(query as CFDictionary)
    if useFileFallback { persistFallbackUnlocked() }
    return true
  }

  private var fallbackPath: String {
    Paths.apiswitchDir + "/.credentials.json"
  }

  private func persistFallbackUnlocked() {
    Paths.ensureDir(Paths.apiswitchDir)
    if let data = try? JSONSerialization.data(withJSONObject: memory, options: [.prettyPrinted]) {
      try? data.write(to: URL(fileURLWithPath: fallbackPath), options: .atomic)
    }
  }

  private func loadFallbackUnlocked() {
    guard let data = try? Data(contentsOf: URL(fileURLWithPath: fallbackPath)),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String]
    else { return }
    for (k, v) in obj { memory[k] = v }
  }
}
