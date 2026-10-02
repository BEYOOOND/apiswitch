import { useEffect, useRef, useState } from 'react'
import { useAppStore, type ProfileDTO } from '../store'
import { Sheet } from './ui/Sheet'
import { Field, inputStyle } from './ui/Field'
import { Button } from './ui/Button'

function slugifyId(name: string): string {
  const lower = name.trim().toLowerCase()
  let s = lower
    .split('')
    .map((ch) => (/[a-z0-9]/.test(ch) ? ch : '_'))
    .join('')
  while (s.includes('__')) s = s.replace(/__/g, '_')
  s = s.replace(/^_+|_+$/g, '')
  return s || 'profile'
}

function sanitizeId(raw: string): string {
  return slugifyId(raw)
}

export function ProfileDrawer() {
  const open = useAppStore((s) => s.drawerOpen)
  const editing = useAppStore((s) => s.editing)
  const closeEditor = useAppStore((s) => s.closeEditor)
  const applySnap = useAppStore((s) => s.applySnap)
  const setLocalBusy = useAppStore((s) => s.setLocalBusy)
  const [form, setForm] = useState<ProfileDTO | null>(null)
  const [activateOnSave, setActivateOnSave] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchHint, setFetchHint] = useState<string | null>(null)
  const [modelOptions, setModelOptions] = useState<string[]>([])
  const [idFollowsName, setIdFollowsName] = useState(true)
  const [isNew, setIsNew] = useState(true)
  const sessionKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open || !editing) {
      sessionKeyRef.current = null
      setForm(null)
      return
    }

    const sessionKey = `${editing.id}:${open}`
    if (sessionKeyRef.current === sessionKey) return
    sessionKeyRef.current = sessionKey

    const existing = useAppStore
      .getState()
      .snap?.data.profiles.some((p) => p.id === editing.id)

    setForm(structuredClone(editing))
    setActivateOnSave(true)
    setSaving(false)
    setFetchingModels(false)
    setFetchHint(null)
    setModelOptions([])
    setIsNew(!existing)
    setIdFollowsName(!existing)
  }, [open, editing])

  if (!open || !form) return null

  const set = <K extends keyof ProfileDTO>(key: K, value: ProfileDTO[K]) => {
    setForm({ ...form, [key]: value })
  }

  const onNameChange = (name: string) => {
    if (idFollowsName && isNew) {
      setForm({ ...form, name, id: slugifyId(name) })
    } else {
      set('name', name)
    }
  }

  const onIdChange = (raw: string) => {
    setIdFollowsName(false)
    const cleaned = raw
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
    set('id', cleaned)
  }

  const fetchModels = async () => {
    if (fetchingModels) return
    setFetchingModels(true)
    setFetchHint(null)
    try {
      const { models } = await window.apiswitch.fetchModels(form)
      const ids = models.map((m) => m.id)
      setModelOptions(ids)
      const next =
        (form.codex.model && ids.includes(form.codex.model) ? form.codex.model : null) ||
        ids[0] ||
        form.codex.model
      setForm({ ...form, codex: { ...form.codex, model: next } })
      setFetchHint(`已拉取 ${models.length} 个模型`)
    } catch (e) {
      setFetchHint((e as Error).message || '拉取失败')
    } finally {
      setFetchingModels(false)
    }
  }

  const save = async () => {
    if (saving) return
    let finalId = sanitizeId(form.id)
    if (!finalId) return

    const profiles = useAppStore.getState().snap?.data.profiles ?? []
    if (isNew && profiles.some((p) => p.id === finalId)) {
      finalId = `${finalId}_${Date.now().toString(36).slice(-4)}`
    }

    setSaving(true)
    setLocalBusy(true)
    const payload: ProfileDTO = { ...form, id: finalId, targets: ['codex'] }
    const shouldActivate = activateOnSave
    closeEditor()
    try {
      const snap = await window.apiswitch.upsert(payload, shouldActivate)
      applySnap(snap)
    } catch {
      await useAppStore.getState().refresh()
    } finally {
      setSaving(false)
      setLocalBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={closeEditor}
      title={isNew ? '新建 Profile' : '编辑 Profile'}
      footer={
        <>
          <Button variant="primary" style={{ flex: 1 }} busy={saving} onClick={() => void save()}>
            保存
          </Button>
          <Button variant="secondary" onClick={closeEditor} disabled={saving}>
            取消
          </Button>
        </>
      }
    >
      <Field label="名称">
        <input
          style={inputStyle}
          value={form.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="例如 TokenFree"
        />
      </Field>
      <Field
        label="ID"
        hint={
          isNew
            ? '可手动修改；默认随名称自动生成（小写字母、数字、下划线）'
            : '已保存的 Profile ID 不可更改'
        }
      >
        <input
          style={{
            ...inputStyle,
            opacity: isNew ? 1 : 0.65
          }}
          className="mono"
          value={form.id}
          disabled={!isNew}
          onChange={(e) => onIdChange(e.target.value)}
          placeholder="tokenfree"
        />
      </Field>
      <Field label="Base URL" hint="例如 https://token-unlimited.com/v1">
        <input
          style={inputStyle}
          className="mono"
          value={form.baseURL}
          onChange={(e) => set('baseURL', e.target.value)}
          placeholder="https://api.example.com/v1"
        />
      </Field>
      <Field label="API Key">
        <input
          style={inputStyle}
          className="mono"
          type="password"
          value={form.apiKey}
          onChange={(e) => set('apiKey', e.target.value)}
          placeholder="sk-…"
        />
      </Field>
      <Field label="Model" hint="写入 Codex 的默认模型">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            className="mono"
            list="apiswitch-model-options"
            value={form.codex.model}
            onChange={(e) => set('codex', { ...form.codex, model: e.target.value })}
            placeholder="gpt-5"
          />
          <Button
            variant="secondary"
            busy={fetchingModels}
            onClick={() => void fetchModels()}
            style={{ fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}
          >
            拉取
          </Button>
        </div>
        <datalist id="apiswitch-model-options">
          {modelOptions.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
        {fetchHint && (
          <div
            style={{
              fontSize: 12,
              color:
                fetchHint.includes('失败') || fetchHint.includes('请先')
                  ? 'var(--danger)'
                  : 'var(--ok)',
              marginTop: 6
            }}
          >
            {fetchHint}
          </div>
        )}
      </Field>

      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          marginTop: 18,
          fontSize: 13
        }}
      >
        <input
          type="checkbox"
          checked={activateOnSave}
          onChange={(e) => setActivateOnSave(e.target.checked)}
        />
        保存后立即启用 Codex
      </label>
    </Sheet>
  )
}
