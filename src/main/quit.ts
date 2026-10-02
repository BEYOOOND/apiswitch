import { app } from 'electron'

export function quitApp(): void {
  ;(app as typeof app & { isQuitting?: boolean }).isQuitting = true
  app.quit()
}

export function isQuitting(): boolean {
  return !!(app as typeof app & { isQuitting?: boolean }).isQuitting
}
