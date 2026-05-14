'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'ak-theme'

export function getEffectiveDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true
  if (pref === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyThemeToDocument(pref: ThemePreference) {
  const dark = getEffectiveDark(pref)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

function readStored(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

const ThemeContext = createContext<{
  theme: ThemePreference
  setTheme: (t: ThemePreference) => void
} | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system')

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const stored = readStored()
      setThemeState(stored)
      applyThemeToDocument(stored)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    applyThemeToDocument(next)
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeToDocument('system')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
