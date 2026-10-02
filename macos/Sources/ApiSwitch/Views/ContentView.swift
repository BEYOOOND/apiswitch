import SwiftUI
import ApiSwitchCore

struct ContentView: View {
  @Environment(AppState.self) private var state
  @State private var tab: Tab = .api

  enum Tab: String, CaseIterable, Identifiable {
    case api = "API"
    case skills = "Skills"
    case agents = "Agents"
    case settings = "Setting"
    var id: String { rawValue }
  }

  var body: some View {
    VStack(spacing: 0) {
      HStack {
        Text("ApiSwitch")
          .font(.headline)
        Text("macOS · v1.1.0")
          .font(.caption)
          .foregroundStyle(.secondary)
        Spacer()
        Text(state.statusLine)
          .font(.caption.monospaced())
          .foregroundStyle(.secondary)
        if state.isBusy {
          ProgressView().controlSize(.small)
        }
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 10)
      .background(.bar)

      Picker("", selection: $tab) {
        ForEach(Tab.allCases) { t in
          Text(t.rawValue).tag(t)
        }
      }
      .pickerStyle(.segmented)
      .padding(.horizontal, 16)
      .padding(.bottom, 8)

      Group {
        switch tab {
        case .api:
          APITab()
        case .skills:
          SkillsTab()
            .onAppear { state.ensureCatalog() }
        case .agents:
          AgentsTab()
            .onAppear { state.ensureCatalog() }
        case .settings:
          SettingsTab()
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)

      if let err = state.errorMessage, !err.isEmpty {
        Text(err)
          .font(.caption)
          .foregroundStyle(.red)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(8)
          .background(Color.red.opacity(0.08))
      } else if !state.statusMessage.isEmpty {
        Text(state.statusMessage)
          .font(.caption)
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(8)
      }
    }
    .sheet(isPresented: Binding(
      get: { state.showEditor },
      set: { state.showEditor = $0 }
    )) {
      if let editing = state.editingProfile {
        ProfileEditor(profile: editing)
      }
    }
  }
}
