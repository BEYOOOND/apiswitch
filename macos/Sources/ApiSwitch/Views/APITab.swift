import SwiftUI
import ApiSwitchCore

struct APITab: View {
  @Environment(AppState.self) private var state

  private var selected: Profile? {
    state.storeData.profiles.first { $0.id == state.selectedId }
  }

  var body: some View {
    HSplitView {
      sidebar
        .frame(minWidth: 240, idealWidth: 280, maxWidth: 340)
      detail
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  private var sidebar: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Button("新建") {
          state.editingProfile = state.newBlankProfile()
          state.showEditor = true
        }
        Button("Codex 回官方") {
          Task { await state.restoreOfficial() }
        }
        .disabled(state.isBusy)
        Button("切回上次") {
          Task { await state.activateLastRelay() }
        }
        .disabled(!state.canActivateLastRelay || state.isBusy)
      }
      .buttonStyle(.bordered)
      .controlSize(.small)

      Text(state.statusLine)
        .font(.caption)
        .foregroundStyle(.secondary)

      List(selection: Binding(
        get: { state.selectedId },
        set: { state.selectedId = $0 }
      )) {
        ForEach(state.storeData.profiles) { p in
          VStack(alignment: .leading, spacing: 4) {
            HStack {
              Text(p.name).font(.headline)
              Spacer()
              if state.storeData.activeByTarget["codex"] == p.id {
                Text("ON")
                  .font(.caption2.bold())
                  .padding(.horizontal, 6)
                  .padding(.vertical, 2)
                  .background(Color.green.opacity(0.85))
                  .foregroundStyle(.white)
                  .clipShape(Capsule())
              }
            }
            Text(p.baseURL.isEmpty ? "(no url)" : p.baseURL)
              .font(.caption.monospaced())
              .foregroundStyle(.secondary)
              .lineLimit(1)
            Text(p.codex.model.isEmpty ? "codex" : p.codex.model)
              .font(.caption2.monospaced())
              .foregroundStyle(.tertiary)
          }
          .tag(p.id)
          .padding(.vertical, 2)
        }
      }
      .listStyle(.sidebar)
    }
    .padding(12)
  }

  private var detail: some View {
    Group {
      if let selected {
        ScrollView {
          VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline) {
              Text(selected.name)
                .font(.largeTitle.bold())
              Text(selected.id)
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
            }
            Text("写入目标：Codex")
              .foregroundStyle(.secondary)

            GroupBox("连接") {
              gridRow("Base URL", selected.baseURL.isEmpty ? "—" : selected.baseURL)
              gridRow("Model", selected.codex.model.isEmpty ? "（默认）" : selected.codex.model)
              gridRow(
                "API Key",
                selected.apiKey.isEmpty
                  ? (selected.apiKeyRef.isEmpty ? "—" : selected.apiKeyRef)
                  : ProfileHelpers.maskKey(selected.apiKey)
              )
            }

            HStack {
              let active = state.storeData.activeByTarget["codex"] == selected.id
              Button(active ? "● 已写入" : "启用此中转") {
                Task { await state.activate(id: selected.id) }
              }
              .buttonStyle(.borderedProminent)
              .disabled(state.isBusy || active)

              Button("编辑") {
                state.editingProfile = selected
                state.showEditor = true
              }
              Button("测试连接") {
                Task { await state.test(selected) }
              }
              .disabled(state.isProbing || state.isBusy)
              Button("复制") { state.duplicate(id: selected.id) }
              Button("删除", role: .destructive) {
                Task { await state.deleteProfile(id: selected.id) }
              }
            }

            if state.isProbing || !state.probeText.isEmpty {
              GroupBox {
                if state.isProbing { ProgressView().controlSize(.small) }
                Text(state.probeText)
                  .font(.system(.caption, design: .monospaced))
                  .textSelection(.enabled)
                  .frame(maxWidth: .infinity, alignment: .leading)
              }
            }
          }
          .padding(24)
          .frame(maxWidth: 720, alignment: .leading)
        }
      } else {
        VStack(alignment: .leading, spacing: 8) {
          Text("选择或新建中转")
            .font(.title.bold())
          Text("一键写入 Codex 中转。关闭窗口后驻留菜单栏。")
            .foregroundStyle(.secondary)
        }
        .padding(48)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      }
    }
  }

  private func gridRow(_ label: String, _ value: String) -> some View {
    HStack(alignment: .top) {
      Text(label)
        .foregroundStyle(.secondary)
        .frame(width: 88, alignment: .leading)
      Text(value)
        .font(.body.monospaced())
        .textSelection(.enabled)
      Spacer()
    }
    .padding(.vertical, 2)
  }
}
