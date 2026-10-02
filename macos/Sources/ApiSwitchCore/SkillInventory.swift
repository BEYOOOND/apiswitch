import Foundation

public struct SkillRecord: Identifiable, Equatable, Sendable {
  public var id: String
  public var name: String
  public var description: String
  public var summary: String
  public var category: String
  public var relativePath: String
  public var scope: String
  public var rootLabel: String
  public var directory: String
  public var skillFile: String
  public var canDelete: Bool
  public var isInSharedLayer: Bool

  public init(
    id: String,
    name: String,
    description: String,
    summary: String,
    category: String,
    relativePath: String,
    scope: String,
    rootLabel: String,
    directory: String,
    skillFile: String,
    canDelete: Bool,
    isInSharedLayer: Bool
  ) {
    self.id = id
    self.name = name
    self.description = description
    self.summary = summary
    self.category = category
    self.relativePath = relativePath
    self.scope = scope
    self.rootLabel = rootLabel
    self.directory = directory
    self.skillFile = skillFile
    self.canDelete = canDelete
    self.isInSharedLayer = isInSharedLayer
  }
}

public struct AgentRecord: Identifiable, Equatable, Sendable {
  public var id: String
  public var name: String
  public var detail: String
  public var path: String
  public var kind: String

  public init(id: String, name: String, detail: String, path: String, kind: String) {
    self.id = id
    self.name = name
    self.detail = detail
    self.path = path
    self.kind = kind
  }
}

private struct RootSpec {
  var label: String
  var url: String
  var scope: String
  var canDelete: Bool
}

public enum SkillInventory {
  public static func scanSkills() -> [SkillRecord] {
    let roots: [RootSpec] = [
      RootSpec(label: "shared (~/.agents/skills)", url: Paths.agentsSkills, scope: "user", canDelete: true),
      RootSpec(label: "codex (~/.codex/skills)", url: Paths.codexSkills, scope: "native", canDelete: false),
      RootSpec(label: "codex system", url: Paths.codexSkills + "/.system", scope: "system", canDelete: false),
      RootSpec(label: "cursor (~/.cursor/skills)", url: Paths.cursorSkills, scope: "native", canDelete: false),
      RootSpec(label: "cursor builtin", url: Paths.cursorSkillsBuiltin, scope: "system", canDelete: false)
    ]
    let sharedNames = sharedSkillFolderNames()
    var records: [SkillRecord] = []
    var seen = Set<String>()
    for root in roots {
      guard FileManager.default.fileExists(atPath: root.url) else { continue }
      records.append(contentsOf: scanRoot(root, seen: &seen, sharedNames: sharedNames))
    }
    return records.sorted {
      if $0.category != $1.category { return $0.category < $1.category }
      return $0.name < $1.name
    }
  }

  private static func sharedSkillFolderNames() -> Set<String> {
    var names = Set<String>()
    guard FileManager.default.fileExists(atPath: Paths.agentsSkills) else { return names }
    walk(Paths.agentsSkills) { file in
      if (file as NSString).lastPathComponent == "SKILL.md" {
        names.insert(((file as NSString).deletingLastPathComponent as NSString).lastPathComponent)
      }
    }
    return names
  }

  private static func scanRoot(
    _ root: RootSpec,
    seen: inout Set<String>,
    sharedNames: Set<String>
  ) -> [SkillRecord] {
    var out: [SkillRecord] = []
    walk(root.url) { file in
      guard (file as NSString).lastPathComponent == "SKILL.md" else { return }
      let dir = (file as NSString).deletingLastPathComponent
      if dir.contains("/Archive/") || dir.contains("/node_modules/") { return }
      let resolved = (try? FileManager.default.destinationOfSymbolicLink(atPath: dir)) ?? dir
      let real = (realpath(resolved) ?? resolved)
      if seen.contains(real) { return }
      seen.insert(real)

      let text = (try? String(contentsOfFile: file, encoding: .utf8)) ?? ""
      let meta = parseFrontmatter(text)
      let folderName = (dir as NSString).lastPathComponent
      let name = meta["name"] ?? folderName
      let rel = relativePath(dir, base: root.url)
      let category = categoryFromRelative(rel)
      let desc = meta["description"] ?? ""
      let summary = String(desc.prefix(120))
      out.append(
        SkillRecord(
          id: "\(root.scope):\(rel)",
          name: name,
          description: desc,
          summary: summary,
          category: category,
          relativePath: rel,
          scope: root.scope,
          rootLabel: root.label,
          directory: dir,
          skillFile: file,
          canDelete: root.canDelete,
          isInSharedLayer: sharedNames.contains(folderName)
        )
      )
    }
    return out
  }

  private static func walk(_ root: String, visit: (String) -> Void) {
    guard let enumerator = FileManager.default.enumerator(atPath: root) else { return }
    while let rel = enumerator.nextObject() as? String {
      visit(root + "/" + rel)
    }
  }

  private static func realpath(_ path: String) -> String? {
    let buf = UnsafeMutablePointer<CChar>.allocate(capacity: Int(PATH_MAX))
    defer { buf.deallocate() }
    guard Darwin.realpath(path, buf) != nil else { return nil }
    return String(cString: buf)
  }

  private static func relativePath(_ path: String, base: String) -> String {
    let b = base.hasSuffix("/") ? base : base + "/"
    if path.hasPrefix(b) { return String(path.dropFirst(b.count)) }
    return (path as NSString).lastPathComponent
  }

  private static func categoryFromRelative(_ rel: String) -> String {
    let parts = rel.split(separator: "/").map(String.init)
    if parts.count >= 2 { return parts[0] }
    return "general"
  }

  private static func parseFrontmatter(_ text: String) -> [String: String] {
    guard text.hasPrefix("---") else { return [:] }
    let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    guard lines.count > 1 else { return [:] }
    var meta: [String: String] = [:]
    for line in lines.dropFirst() {
      if line.hasPrefix("---") { break }
      if let idx = line.firstIndex(of: ":") {
        let key = String(line[..<idx]).trimmingCharacters(in: .whitespaces)
        let val = String(line[line.index(after: idx)...]).trimmingCharacters(in: .whitespaces)
          .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
        meta[key] = val
      }
    }
    return meta
  }
}

public enum AgentInventory {
  public static func scanAgents() -> [AgentRecord] {
    var records: [AgentRecord] = []
    if FileManager.default.fileExists(atPath: Paths.codexAgentsMarkdown) {
      records.append(
        AgentRecord(
          id: "codex-agents-md",
          name: "Codex AGENTS.md",
          detail: "User-level Codex agent instructions",
          path: Paths.codexAgentsMarkdown,
          kind: "codex"
        )
      )
    }
    if FileManager.default.fileExists(atPath: Paths.cursorSkillsBuiltin) {
      records.append(
        AgentRecord(
          id: "cursor-skills-cursor",
          name: "Cursor skills-cursor",
          detail: "Built-in Cursor agent skill pack (read-only)",
          path: Paths.cursorSkillsBuiltin,
          kind: "cursor"
        )
      )
    }
    return records
  }
}
