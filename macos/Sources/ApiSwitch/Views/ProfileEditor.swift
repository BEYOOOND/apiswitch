import SwiftUI
import ApiSwitchCore

struct ProfileEditor: View {
  @Environment(AppState.self) private var state
  @Environment(\.dismiss) private var dismiss

  @State private var form: Profile
  @State private var activateOnSave = true
  @State private var isNew: Bool
  @State private var idFollowsName: Bool
  @State private var saving = false

  init(profile: Profile) {
    _form = State(initialValue: profile)
    let exists = AppState.shared.storeData.profiles.contains { $0.id == profile.id }
    _isNew = State(initialValue: !exists)
    _idFollowsName = State(initialValue: !exists)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text(isNew ? "新建 Profile" : "编辑 Profile")
        .font(.title2.bold())

      labeled("名称") {
        TextField("例如 TokenFree", text: Binding(
          get: { form.name },
          set: { name in
            form.name = name
            if idFollowsName && isNew {
              form.id = ProfileHelpers.slugify(name)
            }
          }
        ))
      }

      labeled("ID") {
        TextField("tokenfree", text: Binding(
          get: { form.id },
          set: { raw in
            idFollowsName = false
            form.id = raw.lowercased()
              .replacingOccurrences(of: "[^a-z0-9_]", with: "_", options: .regularExpression)
              .replacingOccurrences(of: "_+", with: "_", options: .regularExpression)
          }
        ))
        .disabled(!isNew)
        .font(.body.monospaced())
      }

      labeled("Base URL") {
        TextField("https://api.example.com/v1", text: $form.baseURL)
          .font(.body.monospaced())
      }

      labeled("API Key") {
        SecureField("sk-…", text: $form.apiKey)
          .font(.body.monospaced())
      }

      labeled("Model") {
        TextField("gpt-5", text: Binding(
          get: { form.codex.model },
          set: { form.codex.model = $0 }
        ))
        .font(.body.monospaced())
      }

      Toggle("保存后立即启用 Codex", isOn: $activateOnSave)

      HStack {
        Spacer()
        Button("取消") { dismiss() }
        Button("保存") {
          Task { await save() }
        }
        .buttonStyle(.borderedProminent)
        .disabled(saving || form.id.isEmpty)
      }
    }
    .padding(24)
    .frame(width: 440)
  }

  private func labeled<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title).font(.caption).foregroundStyle(.secondary)
      content()
    }
  }

  private func save() async {
    saving = true
    defer { saving = false }
    var finalId = ProfileHelpers.slugify(form.id)
    if finalId.isEmpty { return }
    if isNew, state.storeData.profiles.contains(where: { $0.id == finalId }) {
      finalId = "\(finalId)_\(String(Int(Date().timeIntervalSince1970), radix: 36).suffix(4))"
    }
    var payload = form
    payload.id = finalId
    payload.targets = ["codex"]
    await state.upsert(payload, activate: activateOnSave)
    state.showEditor = false
    dismiss()
  }
}
