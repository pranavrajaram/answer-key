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
    <div className="space-y-1">
      {leaderboard.map((p, i) => {
        const positions = portfolios[p.id] ?? []
        const isOpen = !!expanded[p.id]
        const isMe = p.id === currentUserId

        return (
          <div
            key={p.id}
            className={`rounded-xl border overflow-hidden ${isMe ? 'border-teal-200' : 'border-gray-200'}`}
          >
            {/* Leaderboard row */}
            <button
              onClick={() => positions.length > 0 && toggle(p.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                isMe ? 'bg-teal-50 hover:bg-teal-100' : 'bg-white hover:bg-gray-50'
              } ${positions.length === 0 ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4 tabular-nums">{i + 1}</span>
                <span className={`text-sm ${isMe ? 'font-semibold text-teal-700' : 'font-medium text-gray-800'}`}>
                  {p.username}
                </span>
                {positions.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {positions.length} open
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700 tabular-nums">
                  {p.points_balance.toLocaleString()}
                </span>
                {positions.length > 0 && (
                  <span className={`text-gray-400 text-xs transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                )}
              </div>
            </button>

            {/* Portfolio dropdown */}
            {isOpen && positions.length > 0 && (
              <div className={`border-t px-4 py-2 space-y-1 ${isMe ? 'border-teal-100 bg-teal-50/50' : 'border-gray-100 bg-gray-50'}`}>
                {positions.map(pos => (
                  <Link
                    key={pos.marketId}
                    href={`/markets/${pos.marketId}`}
                    className="flex items-start justify-between gap-2 py-1.5 group"
                  >
                    <span className="text-xs text-gray-600 group-hover:text-teal-700 transition-colors leading-snug line-clamp-2">
                      {pos.question}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 group-hover:text-teal-600 transition-colors">
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
