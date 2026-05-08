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
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 text-center">
        This market is closed. Waiting for resolution.
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <h2 className="font-semibold text-gray-900">Place a bet</h2>

      {/* Option selection */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Choose an outcome</p>
        <div className="grid grid-cols-2 gap-2">
          {market.options.map((opt, i) => {
            const prob = lmsrProb(market.q_values, i, market.b)
            return (
              <button
                key={opt}
                onClick={() => setSelectedOption(opt)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  selectedOption === opt
                    ? 'border-teal-500 bg-teal-50 text-teal-800'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <span className="font-medium block">{opt}</span>
                <span className="text-xs text-gray-400">{formatProbability(prob)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Amount slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-medium text-gray-500">Amount</p>
          <span className="text-sm font-semibold text-gray-900">{amount} pts</span>
        </div>
        <input
          type="range"
          min={10}
          max={Math.min(500, profile.points_balance)}
          step={10}
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          className="w-full accent-teal-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>10</span>
          <span className="text-gray-500">{profile.points_balance} available</span>
          <span>{Math.min(500, profile.points_balance)}</span>
        </div>
      </div>

      {/* Live odds preview */}
      {selectedOption && selectedIndex >= 0 && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-gray-500">New odds after your bet</p>
          <ProbabilityBar
            options={market.options}
            qValues={hypotheticalQ}
            b={market.b}
            highlightIndex={selectedIndex}
          />
          <div className="flex justify-between text-xs pt-1 border-t border-gray-200">
            <span className="text-gray-500">
              {formatProbability(currentProb!)} → {formatProbability(newProb!)}
            </span>
            <span className="font-medium text-gray-700">
              Est. payout: ~{estimatedPayout} pts
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-center">
          Bet placed!
        </p>
      )}

      <button
        onClick={handleBet}
        disabled={!selectedOption || loading || amount > profile.points_balance}
        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Placing bet…' : `Bet ${amount} pts on ${selectedOption ?? '—'}`}
      </button>
    </div>
  )
}
