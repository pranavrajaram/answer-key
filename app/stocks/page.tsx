import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Stock, StockHolding } from '@/lib/types'
import { spotPrice, portfolioValue } from '@/lib/stockMarket'
import Navbar from '@/components/Navbar'
import TabNav from '@/components/TabNav'
import StockCard from '@/components/StockCard'
import StockTrendChart, { TrendSeries } from '@/components/StockTrendChart'
import RoutePrefetcher from '@/components/RoutePrefetcher'

export const revalidate = 0

interface TradeRow {
  stock_id: string
  spot_after: number
  created_at: string
}

export default async function StocksPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: stocks }, { data: holdings }, { data: trades }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('stocks').select('*, profiles!stocks_profile_id_fkey(username)').order('created_at', { ascending: true }),
      supabase.from('stock_holdings').select('*').eq('user_id', user.id),
      supabase.from('stock_trades').select('stock_id, spot_after, created_at').order('created_at', { ascending: false }),
    ])

  const cutoff = new Date().getTime() - 24 * 60 * 60 * 1000

  // For each stock, the spot price from the most recent trade at least 24h old.
  const refPriceByStock: Record<string, number> = {}
  for (const t of (trades ?? []) as TradeRow[]) {
    if (new Date(t.created_at).getTime() <= cutoff && refPriceByStock[t.stock_id] === undefined) {
      refPriceByStock[t.stock_id] = t.spot_after
    }
  }

  const sharesByStock: Record<string, number> = {}
  for (const h of (holdings ?? []) as StockHolding[]) {
    sharesByStock[h.stock_id] = h.shares
  }

  const rows = (stocks ?? []).map((s: Stock) => {
    const price = spotPrice(s.base_price, s.slope, s.shares_outstanding)
    const ref = refPriceByStock[s.id]
    const dayChangePct =
      ref !== undefined && ref > 0 ? ((price - ref) / ref) * 100 : null
    return {
      id: s.id,
      ticker: s.ticker,
      username: s.profiles?.username ?? 'unknown',
      price,
      dayChangePct,
      yourShares: sharesByStock[s.id] ?? 0,
    }
  })

  // Sort by biggest absolute mover, then by price.
  const sorted = [...rows].sort((a, b) => {
    const am = a.dayChangePct === null ? -1 : Math.abs(a.dayChangePct)
    const bm = b.dayChangePct === null ? -1 : Math.abs(b.dayChangePct)
    if (bm !== am) return bm - am
    return b.price - a.price
  })

  const spotByStock: Record<string, number> = {}
  for (const r of rows) spotByStock[r.id] = r.price

  // Build an overlaid price trend per stock: listing price → each trade → current spot.
  const now = new Date().getTime()
  const tradePointsByStock: Record<string, { t: number; price: number }[]> = {}
  for (const t of (trades ?? []) as TradeRow[]) {
    ;(tradePointsByStock[t.stock_id] ??= []).push({
      t: new Date(t.created_at).getTime(),
      price: t.spot_after,
    })
  }
  const stockById = Object.fromEntries((stocks ?? []).map((s: Stock) => [s.id, s]))
  const trendSeries: TrendSeries[] = sorted.map(r => {
    const s = stockById[r.id]
    const created = s?.created_at ? new Date(s.created_at).getTime() : now
    const tradePts = [...(tradePointsByStock[r.id] ?? [])].sort((a, b) => a.t - b.t)
    return {
      ticker: r.ticker,
      points: [{ t: created, price: 10 }, ...tradePts, { t: now, price: r.price }],
    }
  })

  const holdingsValue = portfolioValue(
    (holdings ?? []).map((h: StockHolding) => ({ stockId: h.stock_id, shares: h.shares })),
    spotByStock
  )
  const netWorth = (profile?.points_balance ?? 0) + Math.round(holdingsValue)

  return (
    <div className="ak-page">
      <Navbar profile={profile} />
      <RoutePrefetcher hrefs={sorted.slice(0, 12).map(r => `/stocks/${r.id}`)} />

      <main className="ak-container space-y-6 py-6 sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">Stocks</h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Trade shares of your friends</p>
          </div>
          <div className="rounded-2xl border border-stone-200/80 bg-white/70 px-4 py-2 text-right shadow-sm dark:border-stone-600/60 dark:bg-stone-900/70 dark:shadow-none">
            <p className="text-xs text-stone-500 dark:text-stone-400">Net worth</p>
            <p className="font-semibold tabular-nums text-stone-950 dark:text-stone-100">
              {netWorth.toLocaleString()} <span className="text-xs font-normal text-stone-400">pts</span>
            </p>
          </div>
        </div>

        <TabNav />

        {sorted.length > 0 && (
          <section className="ak-card p-4 sm:p-5">
            <h2 className="ak-section-label mb-3">Trends</h2>
            <StockTrendChart series={trendSeries} />
          </section>
        )}

        {sorted.length === 0 ? (
          <div className="ak-card p-8 text-center text-sm text-stone-400 dark:text-stone-500">
            No stocks yet. They appear as friends join.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sorted.map(r => (
              <StockCard key={r.id} {...r} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
