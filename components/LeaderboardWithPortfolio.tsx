'use client'

import { useState } from 'react'
import Link from 'next/link'

interface LeaderboardEntry {
  id: string
  username: string
  points_balance: number
  stockValue: number
  netWorth: number
}

interface MarketPosition {
  marketId: string
  question: string
  options: string[]  // options this user bet on (deduplicated)
}

interface Props {
  leaderboard: LeaderboardEntry[]
  portfolios: Record<string, MarketPosition[]>  // userId → positions
  currentUserId: string
}

export default function LeaderboardWithPortfolio({ leaderboard, portfolios, currentUserId }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  function toggle(userId: string) {
    setExpanded(prev => ({ ...prev, [userId]: !prev[userId] }))
  }

  return (
    <div className="space-y-2">
      {leaderboard.map((p, i) => {
        const positions = portfolios[p.id] ?? []
        const isOpen = !!expanded[p.id]
        const isMe = p.id === currentUserId

        return (
          <div
            key={p.id}
            className={`overflow-hidden rounded-2xl border ${
              isMe
                ? 'border-teal-200/80 bg-teal-50/70 dark:border-teal-700/40 dark:bg-teal-950/30'
                : 'border-stone-200/80 bg-white/70 dark:border-stone-700/60 dark:bg-stone-900/45'
            }`}
          >
            {/* Leaderboard row */}
            <button
              onClick={() => positions.length > 0 && toggle(p.id)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                isMe
                  ? 'hover:bg-teal-100/60 dark:hover:bg-teal-900/25'
                  : 'hover:bg-white dark:hover:bg-stone-800/40'
              } ${positions.length === 0 ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="w-4 shrink-0 text-xs tabular-nums text-stone-400 dark:text-stone-500">{i + 1}</span>
                <span
                  className={`truncate text-sm ${
                    isMe ? 'font-semibold text-teal-800 dark:text-teal-300' : 'font-medium text-stone-800 dark:text-stone-200'
                  }`}
                >
                  {p.username}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-stone-700 tabular-nums dark:text-stone-200">
                    {p.netWorth.toLocaleString()}
                  </span>
                  {p.stockValue > 0 && (
                    <span className="whitespace-nowrap text-[11px] tabular-nums text-stone-400 dark:text-stone-500">
                      incl. {p.stockValue.toLocaleString()} in stocks
                    </span>
                  )}
                </div>
                {positions.length > 0 && (
                  <span className="text-xs text-stone-400 dark:text-stone-500">
                    {isOpen ? '▴' : '▾'}
                  </span>
                )}
              </div>
            </button>

            {/* Portfolio dropdown */}
            {isOpen && positions.length > 0 && (
              <div
                className={`border-t px-4 py-2 space-y-1 ${
                  isMe
                    ? 'border-teal-100 bg-teal-50/50 dark:border-teal-800/40 dark:bg-teal-950/20'
                    : 'border-stone-100 bg-stone-50/70 dark:border-stone-700/50 dark:bg-stone-900/35'
                }`}
              >
                {positions.map(pos => (
                  <Link
                    key={pos.marketId}
                    href={`/markets/${pos.marketId}`}
                    className="group flex items-start justify-between gap-2 py-1.5"
                  >
                    <span className="line-clamp-2 text-xs leading-snug text-stone-600 transition-colors group-hover:text-teal-700 dark:text-stone-400 dark:group-hover:text-teal-400">
                      {pos.question}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-stone-400 transition-colors group-hover:text-teal-600 dark:text-stone-500 dark:group-hover:text-teal-400">
                      {pos.options.join(', ')} →
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
