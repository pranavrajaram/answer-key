'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Market } from '@/lib/types'
import { lmsrCost, formatProbability, lmsrProb } from '@/lib/lmsr'

interface Position {
  option: string
  net: number // shares held = bets - sells
}

interface SellPanelProps {
  market: Market
  positions: Position[]
}

export default function SellPanel({ market, positions }: SellPanelProps) {
  const router = useRouter()
  const supabase = createClient()

  const holdingPositions = positions.filter(p => p.net > 0)

  const [selectedOption, setSelectedOption] = useState<string | null>(
    holdingPositions.length === 1 ? holdingPositions[0].option : null
  )
  const [shares, setShares] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<number | null>(null)

  const selectedPos = holdingPositions.find(p => p.option === selectedOption)
  const maxShares = selectedPos?.net ?? 0
  const selectedIndex = selectedOption ? market.options.indexOf(selectedOption) : -1

  // Live proceeds estimate (client-side)
  const currentCost = lmsrCost(market.q_values, market.b)
  const hypotheticalQ =
    selectedIndex >= 0
      ? market.q_values.map((q, i) => (i === selectedIndex ? q - Math.min(shares, maxShares) : q))
      : market.q_values
  const newCost = lmsrCost(hypotheticalQ, market.b)
  const estimatedProceeds = Math.max(0, Math.round(currentCost - newCost))

  const currentProb = selectedIndex >= 0 ? lmsrProb(market.q_values, selectedIndex, market.b) : null
  const newProb = selectedIndex >= 0 ? lmsrProb(hypotheticalQ, selectedIndex, market.b) : null

  async function handleSell() {
    if (!selectedOption || shares <= 0 || shares > maxShares) return
    setLoading(true)
    setError(null)
    setResult(null)

    const { data, error: err } = await supabase.rpc('sell_position', {
      p_market_id: market.id,
      p_option: selectedOption,
      p_shares: shares,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setResult(data as number)
    setLoading(false)
    setTimeout(() => {
      router.refresh()
      setResult(null)
      setSelectedOption(holdingPositions.length === 1 ? holdingPositions[0].option : null)
      setShares(10)
    }, 1500)
  }

  if (holdingPositions.length === 0) return null

  return (
    <div className="ak-card p-5 space-y-4">
      <h2 className="font-semibold text-stone-900">Sell position</h2>

      {holdingPositions.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-stone-500">Your positions</p>
          <div className="space-y-1.5">
            {holdingPositions.map(p => (
              <button
                key={p.option}
                onClick={() => { setSelectedOption(p.option); setShares(Math.min(shares, p.net)) }}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  selectedOption === p.option
                    ? 'border-orange-400/80 bg-orange-50 text-orange-900'
                    : 'border-stone-200 bg-white/70 text-stone-700 hover:border-stone-300 hover:bg-white'
                }`}
              >
                <span className="font-medium">{p.option}</span>
                <span className="ml-2 text-xs text-stone-400">{p.net} shares</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {holdingPositions.length === 1 && (
        <div className="rounded-xl border border-stone-200/80 bg-stone-50/80 px-3 py-2 text-sm">
          <span className="text-stone-500">Holding </span>
          <span className="font-semibold text-stone-800">{maxShares} shares</span>
          <span className="text-stone-500"> of </span>
          <span className="font-semibold text-stone-800">{selectedOption}</span>
        </div>
      )}

      {selectedOption && maxShares > 0 && (
        <>
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-semibold text-stone-500">Shares to sell</p>
              <span className="text-sm font-semibold text-stone-900">{Math.min(shares, maxShares)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={maxShares}
              step={1}
              value={Math.min(shares, maxShares)}
              onChange={e => setShares(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="mt-1 flex justify-between text-xs text-stone-400">
              <span>1</span>
              <span>{maxShares} max</span>
            </div>
          </div>

          <div className="rounded-xl border border-orange-200/70 bg-orange-50/80 p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500">Estimated proceeds</span>
              <span className="font-semibold text-orange-700">~{estimatedProceeds} pts</span>
            </div>
            {currentProb !== null && newProb !== null && (
              <div className="flex justify-between text-stone-400">
                <span>Odds after sale</span>
                <span>{formatProbability(currentProb)} → {formatProbability(newProb)}</span>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {result !== null && (
            <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-center text-sm text-teal-700">
              Sold for {result} pts
            </p>
          )}

          <button
            onClick={handleSell}
            disabled={loading || shares <= 0}
            className="w-full rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {loading ? 'Selling…' : `Sell ${Math.min(shares, maxShares)} shares (~${estimatedProceeds} pts)`}
          </button>
        </>
      )}
    </div>
  )
}
