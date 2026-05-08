'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Market, Bet } from '@/lib/types'

interface ResolvePanelProps {
  market: Market
  bets: Bet[]
}

export default function ResolvePanel({ market, bets }: ResolvePanelProps) {
  const router = useRouter()
  const supabase = createClient()

  const [selected, setSelected] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPot = bets.reduce((s, b) => s + b.amount, 0)

  function previewPayouts(winningOption: string) {
    const winning = bets.filter(b => b.option === winningOption)
    const winnersPot = winning.reduce((s, b) => s + b.amount, 0)
    return winning.map(b => ({
      ...b,
      payout: winnersPot > 0 ? Math.round((b.amount / winnersPot) * totalPot) : 0,
    }))
  }

  async function handleResolve() {
    if (!selected) return
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.rpc('resolve_market', {
      p_market_id: market.id,
      p_winning_option: selected,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push(`/markets/${market.id}`)
    router.refresh()
  }

  if (confirming && selected) {
    const payouts = previewPayouts(selected)

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <p className="font-medium text-gray-900">
          Confirm: <span className="text-teal-700">{selected}</span> wins?
        </p>

        {payouts.length > 0 ? (
          <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-500 mb-2">Payouts</p>
            {payouts.map(b => (
              <div key={b.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{b.user_id}</span>
                <span className="font-semibold text-teal-700">+{b.payout} pts</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No bets on this option — no payouts.</p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            Go back
          </button>
          <button
            onClick={handleResolve}
            disabled={loading}
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Resolving…' : 'Confirm & pay out'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Which option won?</p>
      {market.options.map((opt: string) => (
        <button
          key={opt}
          onClick={() => {
            setSelected(opt)
            setConfirming(true)
          }}
          className="w-full text-left px-4 py-3 bg-white border border-gray-200 hover:border-teal-400 hover:bg-teal-50 rounded-xl text-sm font-medium text-gray-800 transition-all"
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
