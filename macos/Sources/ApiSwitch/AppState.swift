import AppKit
import Foundation
import Observation
import ApiSwitchCore

@Observable
@MainActor
public final class AppState {
  public static let shared = AppState()

  public var storeData: StoreData = .empty()
  public var selectedId: String?
  public var statusMessage: String = ""
  public var errorMessage: String?
  public var probeText: String = "Run a connection test to verify the endpoint."
  public var isBusy = false
  public var isProbing = false

  public var skills: [SkillRecord] = []
  public var agents: [AgentRecord] = []
  public var catalogLoaded = false

  public var showMainWindow = false
  public var editingProfile: Profile?
  public var showEditor = false

  public let store = ProfileStore()
  public let switcher: Switcher

  public init() {
    switcher = Switcher(store: store)
    reloadProfiles()
  }

  public var menuTitle: String {
    if let active = storeData.active,
       let p = storeData.profiles.first(where: { $0.id == active })
    {
      let name = p.name
      if name.count <= 10 { return "AS:\(name)" }
      return "AS:\(name.prefix(9))…"
    }
    return "ApiSwitch"
  }

  public var statusLine: String {
    if let id = storeData.activeByTarget["codex"],
       let p = storeData.profiles.first(where: { $0.id == id })
    {
      return "Codex · \(p.name)"
    }
    return "Codex · 官方"
  }

  public var canActivateLastRelay: Bool {
    storeData.active == nil && storeData.lastRelayId != nil
  }

  public func reloadProfiles() {
    storeData = store.load(forceReload: true)
    if let selectedId, storeData.profiles.contains(where: { $0.id == selectedId }) {
      // keep
    } else {
      selectedId = storeData.active ?? storeData.profiles.first?.id
    }
  }

  public func ensureCatalog() {
    guard !catalogLoaded else { return }
    skills = SkillInventory.scanSkills()
    agents = AgentInventory.scanAgents()
    catalogLoaded = true
  }

  public func reloadCatalog() {
    skills = SkillInventory.scanSkills()
    agents = AgentInventory.scanAgents()
    catalogLoaded = true
  }

  public func openMainWindow() {
    showMainWindow = true
    NSApp.activate(ignoringOtherApps: true)
  }

  public func hideMainWindow() {
    showMainWindow = false
  }

  public func activate(id: String) async {
    isBusy = true
    errorMessage = nil
    defer { isBusy = false }
    do {
      _ = try switcher.switchTo(id: id)
      reloadProfiles()
      selectedId = id
      statusMessage = "已启用 · \(storeData.profiles.first(where: { $0.id == id })?.name ?? id)"
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  public func activateLastRelay() async {
    guard let id = storeData.lastRelayId else {
      errorMessage = "还没有上次中转记录，请先启用一个中转 Profile。"
      return
    }
    await activate(id: id)
  }

  public func restoreOfficial() async {
    isBusy = true
    errorMessage = nil
    defer { isBusy = false }
    do {
      _ = try switcher.restoreOfficial()
      reloadProfiles()
      probeText = "已恢复 Codex 官方 Plus（ChatGPT 登录）。"
      statusMessage = "Codex · 官方"
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  public func upsert(_ profile: Profile, activate: Bool) async {
    isBusy = true
    defer { isBusy = false }
    var p = profile
    if p.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      p.name = p.id
    }
    _ = store.upsert(p)
    reloadProfiles()
    if activate {
      await self.activate(id: p.id)
      statusMessage = "已保存并启用 Codex"
    } else {
      statusMessage = "已保存"
    }
  }

  public func deleteProfile(id: String) async {
    let activeOnCodex = storeData.activeByTarget["codex"] == id
    _ = store.delete(id: id)
    if activeOnCodex {
      await restoreOfficial()
    } else {
      reloadProfiles()
    }
  }

  public func duplicate(id: String) {
    do {
      let copy = try store.duplicate(id: id)
      reloadProfiles()
      selectedId = copy.id
      statusMessage = "Duplicated as \(copy.name)"
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  public func test(_ profile: Profile) async {
    isProbing = true
    statusMessage = "测试 \(profile.name)…"
    probeText = statusMessage
    defer { isProbing = false }
    let result = await ConnectionProbe.probeProfile(profile, keychain: store.keychain)
    probeText = result.summary
    statusMessage = result.ok
      ? "测试通过 · \(profile.name)"
      : "测试失败 · \(result.message)"
  }

  public func newBlankProfile() -> Profile {
    let id = store.uniqueId(name: "relay")
    return ProfileHelpers.createProfile(id: id, name: "")
  }

  public func openConfigDir() {
    Paths.ensureDir(Paths.apiswitchDir)
    NSWorkspace.shared.open(URL(fileURLWithPath: Paths.apiswitchDir))
  }

  public func openPath(_ path: String) {
    NSWorkspace.shared.open(URL(fileURLWithPath: path))
  }

  public func exportProfiles(redact: Bool) {
    do {
      let data = try store.exportJSON(redactSecrets: redact)
      let panel = NSSavePanel()
      panel.nameFieldStringValue = redact ? "apiswitch-profiles-redacted.json" : "apiswitch-profiles.json"
      panel.allowedContentTypes = [.json]
      if panel.runModal() == .OK, let url = panel.url {
        try data.write(to: url)
        statusMessage = "Exported"
      }
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  public func importProfiles(replace: Bool) {
    let panel = NSOpenPanel()
    panel.allowedContentTypes = [.json]
    panel.allowsMultipleSelection = false
    if panel.runModal() == .OK, let url = panel.url, let data = try? Data(contentsOf: url) {
      do {
        _ = try store.importJSON(data, replace: replace)
        reloadProfiles()
        statusMessage = "Imported"
      } catch {
        errorMessage = error.localizedDescription
      }
    }
  }

  public func setOpenAtLogin(_ enabled: Bool) {
    LoginItemHelper.setEnabled(enabled)
  }

  public var openAtLogin: Bool {
    LoginItemHelper.isEnabled
  }

  public func quit() {
    NSApp.terminate(nil)
  }
}
