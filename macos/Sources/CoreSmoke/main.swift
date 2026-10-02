import Foundation
import ApiSwitchCore

@main
struct CoreSmoke {
  static func main() throws {
    var failed = 0

    func check(_ name: String, _ ok: @autoclosure () -> Bool) {
      if ok() {
        print("ok  \(name)")
      } else {
        print("FAIL \(name)")
        failed += 1
      }
    }

    let toml = TOMLPatch.upsertModelProvider(
      source: "",
      providerId: "puluai",
      name: "Pulu",
      baseURL: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "gpt-5"
    )
    check("toml provider", toml.contains("model_provider = \"puluai\""))
    check("toml block", toml.contains("[model_providers.puluai]"))

    let cleared = TOMLPatch.clearRelayOverrides(
      "model_provider = \"x\"\nopenai_base_url = \"https://a\"\nfoo = 1\n"
    )
    check("toml clear", !cleared.contains("model_provider") && cleared.contains("foo = 1"))

    let home = NSTemporaryDirectory() + "apiswitch-smoke-\(UUID().uuidString)"
    try FileManager.default.createDirectory(atPath: home, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(atPath: home) }
    Paths.setHomeOverride(home)
    defer { Paths.setHomeOverride(nil) }

    let kc = KeychainStore()
    kc.enableFileFallback(true)
    let store = ProfileStore(keychain: kc)
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
    check("schema 6", obj?["schema_version"] as? Int == 6)
    check("key redacted", profiles?.first?["api_key"] as? String == "")
    check("key ref", profiles?.first?["api_key_ref"] as? String == "keychain:a")
    check("hydrate", store.load(forceReload: true).profiles.first?.apiKey == "secret-key")

    let migrated = ProfileJSON.parseStore([
      "schema_version": 5,
      "active": "a",
      "active_by_target": ["codex": "a", "opencode": "a"],
      "profiles": [[
        "id": "a",
        "name": "A",
        "base_url": "https://x",
        "targets": ["codex", "opencode"],
        "codex": ["provider_id": "", "model": "gpt-5"]
      ]]
    ] as [String: Any])
    check("migrate targets", migrated.profiles.first?.targets == ["codex"])
    check("migrate active map", migrated.activeByTarget == ["codex": "a"])

    try FileManager.default.createDirectory(atPath: Paths.codexDir, withIntermediateDirectories: true)
    let auth: [String: Any] = ["tokens": ["access": "tok"], "auth_mode": "chatgpt"]
    try JSONSerialization.data(withJSONObject: auth).write(to: URL(fileURLWithPath: Paths.codexAuth))
    let switcher = Switcher(store: store)
    _ = store.upsert(
      ProfileHelpers.createProfile(
        id: "relay1",
        name: "Relay",
        baseURL: "https://relay.example/v1",
        apiKey: "sk-relay",
        codex: CodexOptions(model: "gpt-5")
      )
    )
    _ = try switcher.switchTo(id: "relay1")
    let written = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: Paths.codexAuth)))
      as? [String: Any]
    check("switch key", written?["OPENAI_API_KEY"] as? String == "sk-relay")
    check("switch mode", written?["auth_mode"] as? String == "api_key")
    _ = try switcher.restoreOfficial()
    let restored = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: Paths.codexAuth)))
      as? [String: Any]
    let tokens = restored?["tokens"] as? [String: Any]
    check("restore tokens", tokens?["access"] as? String == "tok")
    check("restore mode", restored?["auth_mode"] as? String == "chatgpt")

    if failed > 0 {
      print("\(failed) failed")
      exit(1)
    }
    print("all smoke checks passed")
  }
}
