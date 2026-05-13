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
    <div className="flex gap-1 border-b border-gray-200 mb-8">
      {tabs.map(tab => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
