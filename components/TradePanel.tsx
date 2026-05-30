'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Stock, Profile } from '@/lib/types'
import { spotPrice, buyTotal, sellTotal } from '@/lib/stockMarket'

interface TradePanelProps {
  stock: Stock
  profile: Profile
  yourShares: number
}

export default function TradePanel({ stock, profile, yourShares }: TradePanelProps) {
  const router = useRouter()
  const supabase = createClient()

  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [shares, setShares] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const s = stock.shares_outstanding
  const spot = spotPrice(stock.base_price, stock.slope, s)

  const buy = buyTotal(stock.base_price, stock.slope, s, shares)
  const sell = sellTotal(stock.base_price, stock.slope, s, shares)

  const maxBuyable = Math.max(
    0,
    // rough upper bound so the slider stays usable; exact affordability checked on submit
    Math.floor(profile.points_balance / Math.max(1, spot))
  )
  const max = side === 'buy' ? Math.max(1, maxBuyable) : Math.max(1, yourShares)

  const canSubmit =
    !loading &&
    shares > 0 &&
    (side === 'buy' ? buy.total <= profile.points_balance : shares <= yourShares)

  async function handleTrade() {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const { error: err } = await supabase.rpc(
      side === 'buy' ? 'buy_stock' : 'sell_stock',
      { p_stock_id: stock.id, p_shares: shares }
    )

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setSuccess(
      side === 'buy'
        ? `Bought ${shares} share${shares > 1 ? 's' : ''} for ${buy.total} pts`
        : `Sold ${shares} share${shares > 1 ? 's' : ''} for ${sell.net} pts`
    )
    setLoading(false)
    setTimeout(() => {
      router.refresh()
      setSuccess(null)
      setShares(1)
    }, 1200)
  }

  if (!stock.tradable) {
    return (
      <div className="rounded-2xl border border-stone-200/80 bg-stone-50/80 p-4 text-center text-sm text-stone-500 dark:border-stone-700/60 dark:bg-stone-900/40 dark:text-stone-400">
        This stock is not currently tradable.
      </div>
    )
  }

  return (
    <div className="ak-card space-y-5 p-5">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-stone-200/80 bg-stone-50/80 p-1 dark:border-stone-700/60 dark:bg-stone-900/40">
        {(['buy', 'sell'] as const).map(opt => (
          <button
            key={opt}
            onClick={() => {
              setSide(opt)
              setShares(1)
              setError(null)
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition-colors ${
              side === opt
                ? opt === 'buy'
                  ? 'bg-teal-600 text-white'
                  : 'bg-red-500 text-white'
                : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-500 dark:text-stone-400">Current price</span>
        <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
          {spot.toFixed(1)} pts
        </span>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">Shares</p>
          <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{shares}</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={Math.max(1, Math.min(max, 100))}
            step={1}
            value={Math.min(shares, max)}
            onChange={e => setShares(Number(e.target.value))}
            className={side === 'buy' ? 'w-full accent-teal-600' : 'w-full accent-red-500'}
          />
          <input
            type="number"
            min={1}
            value={shares}
            onChange={e => setShares(Math.max(1, Number(e.target.value) || 1))}
            className="w-16 rounded-lg border border-stone-200 bg-white/70 px-2 py-1 text-right text-sm tabular-nums dark:border-stone-600/70 dark:bg-stone-900/50 dark:text-stone-100"
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-stone-400 dark:text-stone-500">
          <span>{side === 'buy' ? `${profile.points_balance} pts available` : `${yourShares} held`}</span>
        </div>
      </div>

      <div className="space-y-1 rounded-xl border border-stone-200/80 bg-stone-50/80 p-3 text-sm dark:border-stone-700/60 dark:bg-stone-900/40">
        {side === 'buy' ? (
          <>
            <Row label="Cost" value={`${buy.cost} pts`} />
            <Row label="Fee (1%)" value={`${buy.fee} pts`} muted />
            <Row label="Total" value={`${buy.total} pts`} bold />
          </>
        ) : (
          <>
            <Row label="Proceeds" value={`${sell.proceeds} pts`} />
            <Row label="Fee (1%)" value={`−${sell.fee} pts`} muted />
            <Row label="You receive" value={`${sell.net} pts`} bold />
          </>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-center text-sm text-teal-700 dark:border-teal-700/50 dark:bg-teal-950/35 dark:text-teal-300">
          {success}
        </p>
      )}

      <button
        onClick={handleTrade}
        disabled={!canSubmit}
        className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-40 ${
          side === 'buy' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-red-500 hover:bg-red-600'
        }`}
      >
        {loading
          ? 'Working…'
          : side === 'buy'
            ? `Buy ${shares} for ${buy.total} pts`
            : `Sell ${shares} for ${sell.net} pts`}
      </button>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={`flex justify-between ${
        bold ? 'border-t border-stone-200/80 pt-1 font-semibold text-stone-900 dark:border-stone-700/60 dark:text-stone-100' : ''
      } ${muted ? 'text-stone-400 dark:text-stone-500' : 'text-stone-600 dark:text-stone-300'}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
