'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Market, Profile } from '@/lib/types'
import { lmsrProb, newQValues, formatProbability } from '@/lib/lmsr'
import ProbabilityBar from './ProbabilityBar'

interface BetPanelProps {
  market: Market
  profile: Profile
}

export default function BetPanel({ market, profile }: BetPanelProps) {
  const router = useRouter()
  const supabase = createClient()

  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [amount, setAmount] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedIndex = selectedOption
    ? market.options.indexOf(selectedOption)
    : -1

  const hypotheticalQ =
    selectedIndex >= 0
      ? newQValues(market.q_values, selectedIndex, amount)
      : market.q_values

  const currentProb =
    selectedIndex >= 0 ? lmsrProb(market.q_values, selectedIndex, market.b) : null

  const newProb =
    selectedIndex >= 0
      ? lmsrProb(hypotheticalQ, selectedIndex, market.b)
      : null

  // Rough payout estimate based on proportion of winning bets
  // Simplified: payout ≈ amount / newProb (expected value proxy)
  const estimatedPayout =
    newProb !== null ? Math.round(amount / newProb) : null

  const isClosed = new Date(market.closes_at) <= new Date()

  async function handleBet() {
    if (!selectedOption || selectedIndex < 0) return
    if (amount > profile.points_balance) {
      setError("You don't have enough points")
      return
    }

    setLoading(true)
    setError(null)

    const updatedQ = newQValues(market.q_values, selectedIndex, amount)

    const { error: err } = await supabase.rpc('place_bet', {
      p_market_id: market.id,
      p_option: selectedOption,
      p_amount: amount,
      p_new_q_values: updatedQ,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      router.refresh()
      setSuccess(false)
      setSelectedOption(null)
      setAmount(50)
    }, 1200)
  }

  if (isClosed) {
    return (
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-center text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
        This market is closed. Waiting for resolution.
      </div>
    )
  }

  return (
    <div className="ak-card p-5 space-y-5">
      <h2 className="font-semibold text-stone-900 dark:text-stone-100">Place a bet</h2>

      {/* Option selection */}
      <div>
        <p className="mb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Choose an outcome</p>
        <div className="grid grid-cols-2 gap-2">
          {market.options.map((opt, i) => {
            const prob = lmsrProb(market.q_values, i, market.b)
            return (
              <button
                key={opt}
                onClick={() => setSelectedOption(opt)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  selectedOption === opt
                    ? 'border-teal-500/70 bg-teal-50 text-teal-900 dark:border-teal-400/60 dark:bg-teal-950/35 dark:text-teal-100'
                    : 'border-stone-200 bg-white/70 text-stone-700 hover:border-stone-300 hover:bg-white dark:border-stone-600/70 dark:bg-stone-900/50 dark:text-stone-200 dark:hover:border-stone-500 dark:hover:bg-stone-800/60'
                }`}
              >
                <span className="block font-medium">{opt}</span>
                <span className="text-xs text-stone-400 dark:text-stone-500">{formatProbability(prob)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Amount slider */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">Amount</p>
          <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{amount} pts</span>
        </div>
        <input
          type="range"
          min={10}
          max={Math.min(500, profile.points_balance)}
          step={10}
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          className="w-full accent-teal-700"
        />
        <div className="mt-1 flex justify-between text-xs text-stone-400 dark:text-stone-500">
          <span>10</span>
          <span className="text-stone-500 dark:text-stone-400">{profile.points_balance} available</span>
          <span>{Math.min(500, profile.points_balance)}</span>
        </div>
      </div>

      {/* Live odds preview */}
      {selectedOption && selectedIndex >= 0 && (
        <div className="space-y-2 rounded-xl border border-stone-200/80 bg-stone-50/80 p-3 dark:border-stone-700/60 dark:bg-stone-900/40">
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">New odds after your bet</p>
          <ProbabilityBar
            options={market.options}
            qValues={hypotheticalQ}
            b={market.b}
            highlightIndex={selectedIndex}
          />
          <div className="flex justify-between border-t border-stone-200/80 pt-1 text-xs dark:border-stone-700/60">
            <span className="text-stone-500 dark:text-stone-400">
              {formatProbability(currentProb!)} → {formatProbability(newProb!)}
            </span>
            <span className="font-medium text-stone-700 dark:text-stone-200">
              Est. payout: ~{estimatedPayout} pts
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-center text-sm text-teal-700 dark:border-teal-700/50 dark:bg-teal-950/35 dark:text-teal-300">
          Bet placed!
        </p>
      )}

      <button
        onClick={handleBet}
        disabled={!selectedOption || loading || amount > profile.points_balance}
        className="ak-button-primary w-full py-2.5"
      >
        {loading ? 'Placing bet…' : `Bet ${amount} pts on ${selectedOption ?? '—'}`}
      </button>
    </div>
  )
}
