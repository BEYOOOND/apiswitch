import SwiftUI
import ApiSwitchCore

struct SkillsTab: View {
  @Environment(AppState.self) private var state
  @State private var selectedId: String?

  private var selected: SkillRecord? {
    state.skills.first { $0.id == selectedId }
  }

  var body: some View {
    HSplitView {
      List(selection: $selectedId) {
        if !state.catalogLoaded {
          ProgressView("扫描 Skills…")
        } else if state.skills.isEmpty {
          Text("未发现 Skills").foregroundStyle(.secondary)
        } else {
          ForEach(state.skills) { s in
            VStack(alignment: .leading, spacing: 2) {
              Text(s.name).font(.headline)
              Text(s.rootLabel)
                .font(.caption2)
                .foregroundStyle(.secondary)
              Text(s.summary)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            }
            .tag(s.id)
            .padding(.vertical, 2)
          }
        }
      }
      .frame(minWidth: 280)

      Group {
        if let selected {
          VStack(alignment: .leading, spacing: 12) {
            Text(selected.name).font(.title2.bold())
            Text(selected.description.isEmpty ? selected.summary : selected.description)
              .foregroundStyle(.secondary)
            LabeledContent("路径") {
              Text(selected.directory).font(.caption.monospaced()).textSelection(.enabled)
            }
            LabeledContent("范围") { Text(selected.scope) }
            Button("在 Finder 中显示") {
              state.openPath(selected.directory)
            }
            Spacer()
          }
          .padding(24)
        } else {
          Text("选择一个 Skill")
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
      }
    }
    .padding(8)
    .onAppear { state.ensureCatalog() }
    .toolbar {
      ToolbarItem {
        Button("刷新") { state.reloadCatalog() }
      }
    }
  }
}

struct AgentsTab: View {
  @Environment(AppState.self) private var state

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Agents")
        .font(.title2.bold())
      Text("只读清单：发现本机 Codex / Cursor 相关 Agent 资源。")
        .foregroundStyle(.secondary)

      if !state.catalogLoaded {
        ProgressView("扫描…")
      } else if state.agents.isEmpty {
        Text("未发现 Agent 资源").foregroundStyle(.secondary)
      } else {
        List(state.agents) { a in
          HStack {
            VStack(alignment: .leading, spacing: 4) {
              Text(a.name).font(.headline)
              Text(a.detail).font(.caption).foregroundStyle(.secondary)
              Text(a.path).font(.caption2.monospaced()).foregroundStyle(.tertiary)
            }
            Spacer()
            Text(a.kind)
              .font(.caption2.bold())
              .padding(.horizontal, 8)
              .padding(.vertical, 3)
              .background(Color.secondary.opacity(0.15))
              .clipShape(Capsule())
            Button("打开") { state.openPath(a.path) }
          }
          .padding(.vertical, 4)
        }
      }
      Spacer()
    }
    .padding(24)
    .onAppear { state.ensureCatalog() }
    .toolbar {
      ToolbarItem {
        Button("刷新") { state.reloadCatalog() }
      }
    }
  }
}

struct SettingsTab: View {
  @Environment(AppState.self) private var state
  @State private var openAtLogin = false

  var body: some View {
    Form {
      Section("配置") {
        Button("导出 Profiles（脱敏）") { state.exportProfiles(redact: true) }
        Button("导入 Profiles") { state.importProfiles(replace: false) }
        Button("打开配置目录 ~/.apiswitch") { state.openConfigDir() }
      }
      Section("启动") {
        Toggle("登录时启动 ApiSwitch", isOn: $openAtLogin)
          .onChange(of: openAtLogin) { _, v in
            state.setOpenAtLogin(v)
          }
        Text("开启后随系统登录自动启动（托盘驻留）。未签名构建可能无法注册。")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      Section("关于") {
        LabeledContent("版本", value: "ApiSwitch · v1.1.0（原生 macOS）")
        LabeledContent("运行时", value: "SwiftUI MenuBarExtra · accessory")
        Text("关闭主窗口后仅保留菜单栏，不显示程序坞图标。")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
    .formStyle(.grouped)
    .padding(16)
    .onAppear { openAtLogin = state.openAtLogin }
  }
}
