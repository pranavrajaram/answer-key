'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FC } from 'react'

import type { ThemePreference } from './ThemeProvider'
import { useTheme } from './ThemeProvider'

interface ThemeSwitcherProps {
  compact?: boolean
}

type IconComp = FC<{ className?: string }>

const OPTIONS: { value: ThemePreference; label: string; Icon: IconComp }[] = [
  { value: 'light', label: 'Light mode', Icon: SunIcon },
  { value: 'dark', label: 'Dark mode', Icon: MoonIcon },
  { value: 'system', label: 'Use system theme', Icon: MonitorIcon },
]

export default function ThemeSwitcher({ compact = false }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const idx = Math.max(
    0,
    OPTIONS.findIndex(o => o.value === theme)
  )
  const slot = compact ? 32 : 36
  const gap = 4
  const padX = 6
  const openW = padX * 2 + 3 * slot + 2 * gap

  const onDocPointerDown = useCallback((e: PointerEvent) => {
    const t = e.target as Node | null
    if (rootRef.current && t && !rootRef.current.contains(t)) {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    document.addEventListener('pointerdown', onDocPointerDown, true)
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true)
  }, [open, onDocPointerDown])

  const active = OPTIONS[idx]!
  const ActiveIcon = active.Icon
  const closedW = slot

  return (
    <div
      ref={rootRef}
      className="relative isolate flex flex-col items-end"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false)
        }
      }}
      style={{
        width: open ? openW : closedW,
        transition: 'width 320ms cubic-bezier(0.34, 1.15, 0.64, 1)',
      }}
    >
      {/* Single visible control: current theme */}
      <button
        type="button"
        aria-label={`Theme: ${active.label}. Hover or press to change.`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center justify-center rounded-full border border-stone-200/90 bg-stone-100/90 text-stone-600 shadow-sm transition-opacity duration-200 hover:border-stone-300 hover:text-teal-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-teal-600/30 dark:border-stone-600/80 dark:bg-stone-900/70 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:text-teal-300 dark:focus-visible:ring-teal-400/35 ${compact ? 'size-8' : 'size-9'} ${open ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      >
        <span className="ak-theme-icon-pop" key={theme}>
          <ActiveIcon className={compact ? 'size-4' : 'size-[1.125rem]'} />
        </span>
      </button>

      {/* Expanded strip (hover / focus / tap) */}
      <div
        role="group"
        aria-label="Color theme"
        className={`absolute right-0 top-0 flex h-full items-center overflow-hidden rounded-full border border-stone-200/90 bg-stone-100/95 shadow-md backdrop-blur-sm transition-opacity duration-200 dark:border-stone-600/85 dark:bg-stone-900/90 dark:shadow-none ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{
          width: openW,
          paddingLeft: padX,
          paddingRight: padX,
          gap,
        }}
      >
        <span
          className="pointer-events-none absolute bottom-1 top-1 rounded-full bg-teal-600/18 transition-transform duration-300 ease-[cubic-bezier(0.34,1.15,0.64,1)] dark:bg-teal-400/22"
          style={{
            width: slot,
            left: padX,
            transform: `translateX(${idx * (slot + gap)}px)`,
          }}
          aria-hidden
        />
        {OPTIONS.map(opt => {
          const on = opt.value === theme
          return (
            <button
              key={opt.value}
              type="button"
              aria-label={opt.label}
              aria-pressed={on}
              onClick={() => {
                setTheme(opt.value)
                setOpen(false)
              }}
              className={`relative z-10 inline-flex shrink-0 items-center justify-center rounded-full text-stone-600 transition-[color,transform] duration-200 hover:scale-105 hover:text-teal-800 active:scale-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-teal-600/35 dark:text-stone-300 dark:hover:text-teal-300 dark:focus-visible:ring-teal-400/40 ${on ? 'text-teal-800 dark:text-teal-300' : ''} ${compact ? 'size-8' : 'size-9'}`}
            >
              <opt.Icon className={compact ? 'size-4' : 'size-[1.125rem]'} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}
