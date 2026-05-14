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
    <div className="mb-8 inline-flex rounded-2xl border border-stone-200/80 bg-white/60 p-1 shadow-sm">
      {tabs.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? 'bg-stone-950 text-white shadow-sm'
                : 'text-stone-500 hover:bg-white hover:text-stone-900'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
