import type { Profile } from '../domain/profile'
import type { ResolvedCredentials } from '../domain/credential-resolver'

export interface ApplyContext {
  profile: Profile
  credentials: ResolvedCredentials
}

export interface TargetAdapter {
  id: string
  displayName: string
  configPaths: string[]
  apply(ctx: ApplyContext): void | Promise<void>
  clear(): void | Promise<void>
}
