import Foundation

public enum Paths {
  private static var homeOverride: String?

  public static func setHomeOverride(_ dir: String?) {
    homeOverride = dir
  }

  public static var home: String {
    homeOverride ?? NSHomeDirectory()
  }

  public static var apiswitchDir: String { home + "/.apiswitch" }
  public static var profiles: String { apiswitchDir + "/profiles.json" }
  public static var activeEnv: String { apiswitchDir + "/active.env" }
  public static var backupsDir: String { apiswitchDir + "/backups" }
  public static var chatgptTokensBackup: String { apiswitchDir + "/chatgpt_tokens.backup.json" }
  public static var bearerTokenFile: String { apiswitchDir + "/codex_bearer_token" }

  public static var codexDir: String { home + "/.codex" }
  public static var codexAuth: String { codexDir + "/auth.json" }
  public static var codexConfig: String { codexDir + "/config.toml" }
  public static var codexSkills: String { codexDir + "/skills" }
  public static var codexAgentsMarkdown: String { codexDir + "/AGENTS.md" }

  public static var agentsDir: String { home + "/.agents" }
  public static var agentsSkills: String { agentsDir + "/skills" }

  public static var cursorDir: String { home + "/.cursor" }
  public static var cursorSkills: String { cursorDir + "/skills" }
  public static var cursorSkillsBuiltin: String { cursorDir + "/skills-cursor" }

  public static func ensureDir(_ dir: String) {
    let fm = FileManager.default
    if !fm.fileExists(atPath: dir) {
      try? fm.createDirectory(
        atPath: dir,
        withIntermediateDirectories: true,
        attributes: [.posixPermissions: 0o700]
      )
    }
  }

  public static func atomicWrite(_ filePath: String, content: String, mode: Int = 0o600) {
    ensureDir((filePath as NSString).deletingLastPathComponent)
    let dir = (filePath as NSString).deletingLastPathComponent
    let base = (filePath as NSString).lastPathComponent
    let tmp = dir + "/.\(base).tmp.\(ProcessInfo.processInfo.processIdentifier)"
    let data = Data(content.utf8)
    FileManager.default.createFile(atPath: tmp, contents: data, attributes: [.posixPermissions: mode])
    try? FileManager.default.removeItem(atPath: filePath)
    try? FileManager.default.moveItem(atPath: tmp, toPath: filePath)
    try? FileManager.default.setAttributes([.posixPermissions: mode], ofItemAtPath: filePath)
  }

  @discardableResult
  public static func backup(_ urls: [String]) -> String? {
    let existing = urls.filter { FileManager.default.fileExists(atPath: $0) }
    guard !existing.isEmpty else { return nil }
    let stamp = ISO8601DateFormatter().string(from: Date()).replacingOccurrences(of: ":", with: "")
    let dest = backupsDir + "/" + stamp
    ensureDir(dest)
    for u in existing {
      let target = dest + "/" + (u as NSString).lastPathComponent
      try? FileManager.default.copyItem(atPath: u, toPath: target)
    }
    return dest
  }
}
