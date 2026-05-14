'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Markets', href: '/' },
  { label: 'Activity', href: '/activity' },
  { label: 'Stats', href: '/stats' },
]

export default function TabNav() {
  const pathname = usePathname()

  return (
    <nav className="mb-6 grid w-full max-w-sm grid-cols-3 rounded-2xl border border-stone-200/80 bg-white/65 p-1 dark:border-stone-700/60 dark:bg-stone-900/55 sm:inline-grid">
      {tabs.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            className={`rounded-xl px-3 py-2 text-center text-sm font-semibold leading-none transition-colors ${
              active
                ? 'bg-stone-950 text-white'
                : 'text-stone-500 hover:bg-white hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800/70 dark:hover:text-stone-100'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
