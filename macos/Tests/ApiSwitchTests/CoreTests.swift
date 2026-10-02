import XCTest
@testable import ApiSwitchCore

final class TOMLPatchTests: XCTestCase {
  func testUpsertsModelProvider() {
    let out = TOMLPatch.upsertModelProvider(
      source: "",
      providerId: "puluai",
      name: "Pulu",
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-5"
    )
    XCTAssertTrue(out.contains("model_provider = \"puluai\""))
    XCTAssertTrue(out.contains("[model_providers.puluai]"))
    XCTAssertTrue(out.contains("experimental_bearer_token = \"sk-test\""))
  }

  func testClearsRelayOverrides() {
    let src = "model_provider = \"x\"\nopenai_base_url = \"https://a\"\nfoo = 1\n"
    let out = TOMLPatch.clearRelayOverrides(src)
    XCTAssertFalse(out.contains("model_provider"))
    XCTAssertFalse(out.contains("openai_base_url"))
    XCTAssertTrue(out.contains("foo = 1"))
  }
}

final class ProfileStoreTests: XCTestCase {
  var home: String!

  override func setUp() {
    home = NSTemporaryDirectory() + "apiswitch-\(UUID().uuidString)"
    try? FileManager.default.createDirectory(atPath: home, withIntermediateDirectories: true)
    Paths.setHomeOverride(home)
    let kc = KeychainStore()
    kc.enableFileFallback(true)
  }

  override func tearDown() {
    Paths.setHomeOverride(nil)
    try? FileManager.default.removeItem(atPath: home)
  }

  func testRoundTripSecrets() throws {
    let store = ProfileStore(keychain: {
      let k = KeychainStore()
      k.enableFileFallback(true)
      return k
    }())
    _ = store.upsert(
      ProfileHelpers.createProfile(
        id: "a",
        name: "A",
        baseURL: "https://x",
        apiKey: "secret-key"
      )
    )
    let raw = try Data(contentsOf: URL(fileURLWithPath: Paths.profiles))
    let obj = try JSONSerialization.jsonObject(with: raw) as? [String: Any]
    let profiles = obj?["profiles"] as? [[String: Any]]
    XCTAssertEqual(profiles?.first?["api_key"] as? String, "")
    XCTAssertEqual(profiles?.first?["api_key_ref"] as? String, "keychain:a")
    XCTAssertEqual(obj?["schema_version"] as? Int, 6)

    let loaded = store.load(forceReload: true)
    XCTAssertEqual(loaded.profiles.first?.apiKey, "secret-key")
  }

  func testMigrateDropsOpenCodeTargets() {
    let migrated = ProfileJSON.parseStore([
      "schema_version": 5,
      "active": "a",
      "last_relay_id": "a",
      "active_by_target": ["codex": "a", "opencode": "a"],
      "profiles": [[
        "id": "a",
        "name": "A",
        "base_url": "https://x",
        "api_key": "k",
        "targets": ["codex", "opencode"],
        "codex": ["provider_id": "", "model": "gpt-5"]
      ]]
    ] as [String: Any])
    XCTAssertEqual(migrated.schemaVersion, 6)
    XCTAssertEqual(migrated.profiles.first?.targets, ["codex"])
    XCTAssertEqual(migrated.activeByTarget, ["codex": "a"])
  }

  func testSwitcherWritesCodexOnly() throws {
    try FileManager.default.createDirectory(atPath: Paths.codexDir, withIntermediateDirectories: true)
    let auth: [String: Any] = ["tokens": ["access": "tok"], "auth_mode": "chatgpt"]
    let authData = try JSONSerialization.data(withJSONObject: auth, options: [.prettyPrinted])
    try authData.write(to: URL(fileURLWithPath: Paths.codexAuth))

    let kc = KeychainStore()
    kc.enableFileFallback(true)
    let store = ProfileStore(keychain: kc)
    let switcher = Switcher(store: store)
    _ = store.upsert(
      ProfileHelpers.createProfile(
        id: "relay1",
        name: "Relay One",
        baseURL: "https://relay.example/v1",
        apiKey: "sk-relay",
        codex: CodexOptions(model: "gpt-5")
      )
    )
    _ = try switcher.switchTo(id: "relay1")

    let written = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: Paths.codexAuth))) as? [String: Any]
    XCTAssertEqual(written?["OPENAI_API_KEY"] as? String, "sk-relay")
    XCTAssertEqual(written?["auth_mode"] as? String, "api_key")
    XCTAssertNil(written?["tokens"])
    XCTAssertTrue(FileManager.default.fileExists(atPath: Paths.chatgptTokensBackup))

    _ = try switcher.restoreOfficial()
    let restored = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: Paths.codexAuth))) as? [String: Any]
    let tokens = restored?["tokens"] as? [String: Any]
    XCTAssertEqual(tokens?["access"] as? String, "tok")
    XCTAssertEqual(restored?["auth_mode"] as? String, "chatgpt")
  }
}
