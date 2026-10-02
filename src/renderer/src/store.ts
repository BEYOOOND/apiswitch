import { create } from 'zustand'

export type Section = 'codex' | 'skills' | 'agents' | 'settings'

export interface AppStateSnapshot {
  data: {
    schemaVersion: number
    active: string | null
    lastRelayId: string | null
    activeByTarget: Record<string, string>
    profiles: ProfileDTO[]
  }
  skills: SkillDTO[]
  agents: AgentDTO[]
  statusMessage: string
  errorMessage: string | null
  lastProbe: ProbeDTO | null
  probeText: string
  isProbing: boolean
  isBusy?: boolean
  busyPhase?: string | null
  catalogLoaded?: boolean
  menuTitle: string
  statusLine: string
  canActivateLastRelay: boolean
  mirrorTargets: { id: string; displayName: string }[]
  openAtLogin: boolean
}

export interface ProfileDTO {
  id: string
  name: string
  baseURL: string
  apiKey: string
  apiKeyRef: string
  targets: string[]
  codex: { providerId: string; model: string }
  overrides: Record<
    string,
    { baseURL: string; apiKey: string; apiKeyRef: string }
  >
}

export interface SkillDTO {
  id: string
  name: string
  description: string
  summary: string
  category: string
  relativePath: string
  scope: string
  rootLabel: string
  directory: string
  skillFile: string
  isSymlink: boolean
  canDelete: boolean
  isInSharedLayer: boolean
}

export interface AgentDTO {
  id: string
  name: string
  detail: string
  path: string
  kind: string
}

export interface ProbeDTO {
  ok: boolean
  endpoint: string
  statusCode: number | null
  latencyMs: number
  message: string
}

interface Store {
  section: Section
  snap: AppStateSnapshot | null
  selectedId: string | null
  drawerOpen: boolean
  editing: ProfileDTO | null
  confirm: null | { kind: string; payload?: unknown }
  localBusy: boolean
  progressPhase: string | null
  setSection: (s: Section) => void
  applySnap: (snap: AppStateSnapshot) => void
  select: (id: string | null) => void
  openEditor: (p: ProfileDTO | null) => void
  closeEditor: () => void
  setConfirm: (c: Store['confirm']) => void
  setLocalBusy: (v: boolean) => void
  setProgressPhase: (p: string | null) => void
  refresh: () => Promise<void>
  runBusy: (fn: () => Promise<unknown>, opts?: { optimisticActive?: string }) => Promise<void>
}

export const useAppStore = create<Store>((set, get) => ({
  section: 'codex',
  snap: null,
  selectedId: null,
  drawerOpen: false,
  editing: null,
  confirm: null,
  localBusy: false,
  progressPhase: null,
  setSection: (section) => set({ section }),
  applySnap: (snap) => {
    const selectedId = get().selectedId
    const still =
      selectedId && snap.data.profiles.some((p) => p.id === selectedId)
        ? selectedId
        : snap.data.active ?? snap.data.profiles[0]?.id ?? null
    set({
      snap,
      selectedId: still,
      localBusy: !!snap.isBusy,
      progressPhase: snap.busyPhase ?? get().progressPhase
    })
  },
  select: (selectedId) => set({ selectedId }),
  openEditor: (editing) => set({ drawerOpen: true, editing }),
  closeEditor: () => set({ drawerOpen: false, editing: null }),
  setConfirm: (confirm) => set({ confirm }),
  setLocalBusy: (localBusy) => set({ localBusy }),
  setProgressPhase: (progressPhase) => set({ progressPhase }),
  refresh: async () => {
    const snap = (await window.apiswitch.getState()) as AppStateSnapshot
    get().applySnap(snap)
  },
  runBusy: async (fn, opts) => {
    const prev = get().snap
    set({ localBusy: true, progressPhase: 'preparing' })
    if (opts?.optimisticActive && prev) {
      set({
        snap: {
          ...prev,
          data: { ...prev.data, active: opts.optimisticActive },
          isBusy: true
        },
        selectedId: opts.optimisticActive
      })
    }
    try {
      const next = (await fn()) as AppStateSnapshot
      get().applySnap(next)
    } catch {
      if (prev) get().applySnap(prev)
      await get().refresh()
    } finally {
      set({ localBusy: false, progressPhase: null })
    }
  }
}))
