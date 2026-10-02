import AppKit
import SwiftUI
import ApiSwitchCore

@main
struct ApiSwitchApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

  var body: some Scene {
    // Status item + main window are owned by AppDelegate (NSStatusItem / NSHostingWindow).
    // Settings scene keeps the SwiftUI app lifecycle alive without a Dock icon.
    Settings {
      EmptyView()
    }
  }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate, NSWindowDelegate {
  private var statusItem: NSStatusItem?
  private var mainWindow: NSWindow?

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.accessory)
    installStatusItem()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    false
  }

  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    openMainWindow()
    return true
  }

  // MARK: - Status item

  private func installStatusItem() {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    if let button = item.button {
      let image = StatusItemIcon.pixelA
      image.isTemplate = true
      button.image = image
      button.image?.size = NSSize(width: 16, height: 16)
      button.toolTip = "ApiSwitch"
    }
    let menu = NSMenu()
    menu.delegate = self
    item.menu = menu
    statusItem = item
    rebuildMenu(menu)
  }

  func menuNeedsUpdate(_ menu: NSMenu) {
    AppState.shared.reloadProfiles()
    rebuildMenu(menu)
  }

  private func rebuildMenu(_ menu: NSMenu) {
    menu.removeAllItems()
    let state = AppState.shared
    let activeId = state.storeData.activeByTarget["codex"] ?? state.storeData.active

    func disabled(_ title: String) {
      let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
      item.isEnabled = false
      menu.addItem(item)
    }

    disabled(state.statusLine)
    if state.isBusy {
      disabled("切换中…")
    } else if let err = state.errorMessage, !err.isEmpty {
      disabled(err)
    } else if !state.statusMessage.isEmpty {
      disabled(state.statusMessage)
    }

    menu.addItem(.separator())

    let official = NSMenuItem(title: "Codex 回官方", action: #selector(restoreOfficial), keyEquivalent: "")
    official.target = self
    official.isEnabled = !state.isBusy
    menu.addItem(official)

    let last = NSMenuItem(title: "切回上次中转", action: #selector(activateLast), keyEquivalent: "")
    last.target = self
    last.isEnabled = state.canActivateLastRelay && !state.isBusy
    menu.addItem(last)

    menu.addItem(.separator())

    if state.storeData.profiles.isEmpty {
      disabled("还没有 Profile")
    } else {
      for profile in state.storeData.profiles {
        let mark = activeId == profile.id ? "● " : "○ "
        let model = profile.codex.model.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = model.isEmpty ? mark + profile.name : "\(mark)\(profile.name)  ·  \(model)"
        let item = NSMenuItem(title: title, action: #selector(activateProfile(_:)), keyEquivalent: "")
        item.target = self
        item.representedObject = profile.id
        item.isEnabled = !state.isBusy
        menu.addItem(item)
      }
    }

    menu.addItem(.separator())

    let test = NSMenuItem(title: "测试当前中转", action: #selector(testCurrent), keyEquivalent: "")
    test.target = self
    test.isEnabled = activeId != nil && !state.isBusy && !state.isProbing
    menu.addItem(test)

    let open = NSMenuItem(title: "打开主窗口", action: #selector(openMainWindow), keyEquivalent: "")
    open.target = self
    menu.addItem(open)

    let refresh = NSMenuItem(title: "刷新列表", action: #selector(refreshList), keyEquivalent: "")
    refresh.target = self
    menu.addItem(refresh)

    menu.addItem(.separator())

    let quit = NSMenuItem(title: "退出 ApiSwitch", action: #selector(quitApp), keyEquivalent: "q")
    quit.target = self
    menu.addItem(quit)
  }

  @objc private func restoreOfficial() {
    Task { @MainActor in await AppState.shared.restoreOfficial() }
  }

  @objc private func activateLast() {
    Task { @MainActor in await AppState.shared.activateLastRelay() }
  }

  @objc private func activateProfile(_ sender: NSMenuItem) {
    guard let id = sender.representedObject as? String else { return }
    Task { @MainActor in await AppState.shared.activate(id: id) }
  }

  @objc private func testCurrent() {
    let state = AppState.shared
    let activeId = state.storeData.activeByTarget["codex"] ?? state.storeData.active
    guard let activeId,
          let profile = state.storeData.profiles.first(where: { $0.id == activeId })
    else { return }
    Task { @MainActor in await state.test(profile) }
  }

  @objc func openMainWindow() {
    AppState.shared.openMainWindow()
    let window = ensureMainWindow()
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  @objc private func refreshList() {
    AppState.shared.reloadProfiles()
  }

  @objc private func quitApp() {
    AppState.shared.quit()
  }

  // MARK: - Main window

  private func ensureMainWindow() -> NSWindow {
    if let mainWindow { return mainWindow }

    let root = NSHostingView(
      rootView: ContentView()
        .environment(AppState.shared)
        .frame(minWidth: 900, minHeight: 560)
    )
    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1080, height: 700),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "ApiSwitch"
    window.contentView = root
    window.delegate = self
    window.isReleasedWhenClosed = false
    window.center()
    window.setFrameAutosaveName("ApiSwitchMain")
    mainWindow = window
    return window
  }

  func windowShouldClose(_ sender: NSWindow) -> Bool {
    sender.orderOut(nil)
    AppState.shared.hideMainWindow()
    return false
  }
}

enum StatusItemIcon {
  static var pixelA: NSImage {
    if let img = loadTrayPNG() {
      let copy = img.copy() as? NSImage ?? img
      copy.isTemplate = true
      copy.size = NSSize(width: 16, height: 16)
      return copy
    }
    return drawPixelAFallback()
  }

  private static func loadTrayPNG() -> NSImage? {
    let candidates: [URL] = [
      Bundle.main.url(forResource: "tray-16", withExtension: "png"),
      Bundle.main.resourceURL?.appendingPathComponent("tray-16.png"),
      Bundle.main.bundleURL.appendingPathComponent("Contents/Resources/tray-16.png")
    ].compactMap { $0 }

    for url in candidates {
      guard FileManager.default.fileExists(atPath: url.path),
            let img = NSImage(contentsOf: url),
            img.isValid
      else { continue }
      return img
    }
    return nil
  }

  private static func drawPixelAFallback() -> NSImage {
    let px = 16
    let image = NSImage(size: NSSize(width: px, height: px), flipped: false) { _ in
      guard let ctx = NSGraphicsContext.current?.cgContext else { return false }
      ctx.clear(CGRect(x: 0, y: 0, width: px, height: px))
      ctx.setFillColor(NSColor.black.cgColor)
      func plot(_ x: Int, _ y: Int) {
        ctx.fill(CGRect(x: x, y: px - 1 - y, width: 1, height: 1))
      }
      let cx = Double(px - 1) / 2
      let cy = Double(px - 1) / 2
      let rad = Double(px) / 2 - 0.8
      for y in 0..<px {
        for x in 0..<px {
          let dx = Double(x) - cx
          let dy = Double(y) - cy
          let d = dx * dx + dy * dy
          if d <= rad * rad && d >= (rad - 1.6) * (rad - 1.6) { plot(x, y) }
        }
      }
      for y in 3...12 {
        let t = Double(y - 3) / 9
        let lx = Int((7.5 - t * 3.5).rounded())
        let rx = Int((7.5 + t * 3.5).rounded())
        plot(lx, y); plot(lx + 1, y)
        plot(rx, y); plot(rx - 1, y)
      }
      for x in 5...10 { plot(x, 8); plot(x, 9) }
      return true
    }
    image.isTemplate = true
    return image
  }
}
