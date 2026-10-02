import { useEffect, useState } from 'react'

function isMacUA(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/.test(navigator.platform) || navigator.userAgent.includes('Mac')
}

/**
 * Platform-aware titlebar insets.
 * - Windows: right inset for titleBarOverlay caption buttons (WCO geometry).
 * - macOS: left inset so brand text clears traffic lights (hiddenInset).
 */
export function useWindowControlsInset(fallbackRight = 140): {
  left: number
  right: number
  isMac: boolean
} {
  const mac = isMacUA()
  const [right, setRight] = useState(mac ? 16 : fallbackRight)
  const [left, setLeft] = useState(mac ? 84 : 16)

  useEffect(() => {
    document.documentElement.dataset.platform = mac ? 'mac' : 'win'

    if (mac) {
      setLeft(84)
      setRight(16)
      document.documentElement.style.setProperty('--traffic-lights-w', '84px')
      document.documentElement.style.setProperty('--window-controls-w', '16px')
      document.documentElement.style.setProperty('--titlebar-h', '52px')
      return
    }

    const wco = (
      navigator as Navigator & {
        windowControlsOverlay?: {
          visible?: boolean
          getTitlebarAreaRect: () => DOMRect
          addEventListener: (type: string, listener: () => void) => void
          removeEventListener: (type: string, listener: () => void) => void
        }
      }
    ).windowControlsOverlay

    const update = () => {
      if (wco?.getTitlebarAreaRect) {
        try {
          const rect = wco.getTitlebarAreaRect()
          const gap = Math.max(0, Math.round(window.innerWidth - rect.x - rect.width))
          const inset = Math.max(fallbackRight, gap + 16)
          setRight(inset)
          setLeft(16)
          document.documentElement.style.setProperty('--window-controls-w', `${inset}px`)
          document.documentElement.style.setProperty('--traffic-lights-w', '16px')
          return
        } catch {
          /* fall through */
        }
      }
      setRight(fallbackRight)
      setLeft(16)
      document.documentElement.style.setProperty('--window-controls-w', `${fallbackRight}px`)
      document.documentElement.style.setProperty('--traffic-lights-w', '16px')
    }

    update()
    window.addEventListener('resize', update)
    wco?.addEventListener('geometrychange', update)
    return () => {
      window.removeEventListener('resize', update)
      wco?.removeEventListener('geometrychange', update)
    }
  }, [fallbackRight, mac])

  return { left, right, isMac: mac }
}
