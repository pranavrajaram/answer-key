'use client'

import { useState } from 'react'
import Link from 'next/link'

interface LeaderboardEntry {
  id: string
  username: string
  points_balance: number
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
            className={`overflow-hidden rounded-2xl border shadow-sm ${isMe ? 'border-teal-200/80 bg-teal-50/70' : 'border-stone-200/80 bg-white/70'}`}
          >
            {/* Leaderboard row */}
            <button
              onClick={() => positions.length > 0 && toggle(p.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                isMe ? 'hover:bg-teal-100/60' : 'hover:bg-white'
              } ${positions.length === 0 ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-4 text-xs tabular-nums text-stone-400">{i + 1}</span>
                <span className={`text-sm ${isMe ? 'font-semibold text-teal-800' : 'font-medium text-stone-800'}`}>
                  {p.username}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-stone-700 tabular-nums">
                  {p.points_balance.toLocaleString()}
                </span>
                {positions.length > 0 && (
                  <span className={`text-xs text-stone-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                )}
              </div>
            </button>

            {/* Portfolio dropdown */}
            {isOpen && positions.length > 0 && (
              <div className={`border-t px-4 py-2 space-y-1 ${isMe ? 'border-teal-100 bg-teal-50/50' : 'border-stone-100 bg-stone-50/70'}`}>
                {positions.map(pos => (
                  <Link
                    key={pos.marketId}
                    href={`/markets/${pos.marketId}`}
                    className="group flex items-start justify-between gap-2 py-1.5"
                  >
                    <span className="line-clamp-2 text-xs leading-snug text-stone-600 transition-colors group-hover:text-teal-700">
                      {pos.question}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-stone-400 transition-colors group-hover:text-teal-600">
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
