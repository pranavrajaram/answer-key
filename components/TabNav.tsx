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
    <nav className="mb-6 grid w-full max-w-sm grid-cols-3 rounded-2xl border border-stone-200/80 bg-white/65 p-1 dark:border-stone-600/35 dark:bg-stone-800/35 sm:inline-grid">
      {tabs.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            className={`rounded-xl px-3 py-2 text-center text-sm font-semibold leading-none transition-colors duration-200 ${
              active
                ? 'bg-stone-900 text-white shadow-sm dark:bg-teal-500/18 dark:text-teal-50 dark:shadow-none dark:ring-1 dark:ring-inset dark:ring-teal-400/35'
                : 'text-stone-500 hover:bg-white hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-700/50 dark:hover:text-stone-100'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
