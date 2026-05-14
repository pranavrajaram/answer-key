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
      <div className="ak-card p-5 space-y-4">
        <p className="font-medium text-stone-900">
          Confirm: <span className="text-teal-700">{selected}</span> wins?
        </p>

        {payouts.length > 0 ? (
          <div className="rounded-xl border border-stone-200/80 bg-stone-50/80 p-3 space-y-1.5">
            <p className="mb-2 text-xs font-semibold text-stone-500">Payouts</p>
            {payouts.map(b => (
              <div key={b.id} className="flex justify-between text-sm">
                <span className="text-stone-600">{b.user_id}</span>
                <span className="font-semibold text-teal-700">+{b.payout} pts</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">No bets on this option — no payouts.</p>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="ak-button-secondary flex-1 py-2.5"
          >
            Go back
          </button>
          <button
            onClick={handleResolve}
            disabled={loading}
            className="ak-button-primary flex-1 py-2.5"
          >
            {loading ? 'Resolving…' : 'Confirm & pay out'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-stone-700">Which option won?</p>
      {market.options.map((opt: string) => (
        <button
          key={opt}
          onClick={() => {
            setSelected(opt)
            setConfirming(true)
          }}
          className="ak-card-solid ak-card-hover w-full px-4 py-3 text-left text-sm font-semibold text-stone-800 hover:bg-teal-50/60"
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
