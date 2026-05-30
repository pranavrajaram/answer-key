import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StockTrade, StockHolding, StockEvent } from '@/lib/types'
import { spotPrice } from '@/lib/stockMarket'
import Navbar from '@/components/Navbar'
import TradePanel from '@/components/TradePanel'
import StockChart from '@/components/StockChart'
import EventFeed, { FeedEvent } from '@/components/EventFeed'
import EventProposeForm from '@/components/EventProposeForm'
import StockRealtime from '@/components/StockRealtime'

export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StockPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: stock }, { data: profile }, { data: trades }, { data: holdings }, { data: events }] =
    await Promise.all([
      supabase.from('stocks').select('*, profiles!stocks_profile_id_fkey(username)').eq('id', id).single(),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('stock_trades')
        .select('*, profiles(username)')
        .eq('stock_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('stock_holdings').select('*, profiles(username)').eq('stock_id', id),
      supabase
        .from('stock_events')
        .select('*, profiles!stock_events_proposed_by_fkey(username)')
        .eq('stock_id', id)
        .order('created_at', { ascending: false }),
    ])

  if (!stock) notFound()

  // Confirmations for this stock's events (to show counts + my vote).
  const eventIds = (events ?? []).map((e: StockEvent) => e.id)
  const { data: confirmations } = eventIds.length
    ? await supabase
        .from('stock_event_confirmations')
        .select('event_id, user_id, vote')
        .in('event_id', eventIds)
    : { data: [] }

  const feedEvents: FeedEvent[] = (events ?? []).map((e: StockEvent) => {
    const myRows = (confirmations ?? []).filter(
      (c: { event_id: string; user_id: string; vote: number }) => c.event_id === e.id
    )
    return {
      id: e.id,
      type: e.type,
      label: e.label,
      multiplier: e.multiplier,
      dividend_per_share: e.dividend_per_share,
      status: e.status,
      created_at: e.created_at,
      applied_at: e.applied_at,
      proposerName: e.profiles?.username ?? 'someone',
      confirmCount: myRows.filter(c => c.vote === 1).length,
      myVote: myRows.find(c => c.user_id === user.id)?.vote ?? null,
    }
  })

  const spot = spotPrice(stock.base_price, stock.slope, stock.shares_outstanding)
  const yourShares =
    (holdings ?? []).find((h: StockHolding) => h.user_id === user.id)?.shares ?? 0

  const orderedTrades = [...((trades ?? []) as StockTrade[])].reverse() // oldest → newest
  const chartPoints = orderedTrades.map(t => t.spot_after)
  if (chartPoints.length > 0) chartPoints.push(spot)

  const topHolders = [...((holdings ?? []) as StockHolding[])]
    .filter(h => h.shares > 0)
    .sort((a, b) => b.shares - a.shares)
    .slice(0, 10)

  const username = stock.profiles?.username ?? 'unknown'

  return (
    <div className="ak-page">
      <Navbar profile={profile} />
      <StockRealtime stockId={stock.id} />

      <main className="ak-container py-6 sm:py-8">
        <div className="mb-5 flex items-center gap-2 text-sm text-stone-400 dark:text-stone-500">
          <Link href="/stocks" className="transition-colors hover:text-stone-800 dark:hover:text-stone-200">
            Stocks
          </Link>
          <span>/</span>
          <span className="font-mono text-stone-600 dark:text-stone-300">${stock.ticker}</span>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
          <div className="space-y-5 xl:col-span-2">
            <div className="ak-card p-4 sm:p-6">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h1 className="font-mono text-2xl font-bold tracking-wide text-stone-950 dark:text-stone-100">
                    ${stock.ticker}
                  </h1>
                  <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{username}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums text-stone-950 dark:text-stone-100">
                    {spot.toFixed(1)}
                    <span className="ml-1 text-sm font-normal text-stone-400">pts</span>
                  </p>
                  <p className="text-xs text-stone-400 dark:text-stone-500">
                    {stock.shares_outstanding} shares outstanding
                  </p>
                </div>
              </div>

              <StockChart points={chartPoints} />
            </div>

            <EventFeed events={feedEvents} />

            {/* Top holders */}
            <div className="ak-card p-4 sm:p-6">
              <h2 className="mb-4 font-semibold text-stone-900 dark:text-stone-100">Top holders</h2>
              {topHolders.length === 0 ? (
                <p className="text-sm text-stone-400 dark:text-stone-500">Nobody holds shares yet.</p>
              ) : (
                <div className="space-y-2">
                  {topHolders.map(h => (
                    <div
                      key={h.user_id}
                      className="flex items-center justify-between border-b border-stone-100/80 py-1.5 text-sm last:border-0 dark:border-stone-800/80"
                    >
                      <span
                        className={`font-medium ${
                          h.user_id === user.id
                            ? 'text-teal-700 dark:text-teal-400'
                            : 'text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        {h.profiles?.username ?? 'unknown'}
                        {h.user_id === user.id && (
                          <span className="ml-1 text-stone-400 dark:text-stone-500">you</span>
                        )}
                      </span>
                      <span className="tabular-nums text-stone-500 dark:text-stone-400">{h.shares} shares</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent trades */}
            {(trades ?? []).length > 0 && (
              <div className="ak-card p-4 sm:p-6">
                <h2 className="mb-4 font-semibold text-stone-900 dark:text-stone-100">Recent trades</h2>
                <div className="space-y-2">
                  {(trades ?? []).slice(0, 20).map((t: StockTrade) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between border-b border-stone-100/80 py-1.5 text-sm last:border-0 dark:border-stone-800/80"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-stone-600 dark:text-stone-400">{t.profiles?.username ?? 'unknown'}</span>
                        <span
                          className={`text-xs font-semibold uppercase ${
                            t.side === 'buy' ? 'text-teal-600 dark:text-teal-400' : 'text-red-500 dark:text-red-400'
                          }`}
                        >
                          {t.side}
                        </span>
                        <span className="text-stone-400 dark:text-stone-500">{t.shares} @ {t.spot_after.toFixed(1)}</span>
                      </div>
                      <span className="tabular-nums text-stone-500 dark:text-stone-400">{t.cost} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 xl:col-span-1">
            {profile && <TradePanel stock={stock} profile={profile} yourShares={yourShares} />}

            <EventProposeForm stockId={stock.id} ticker={stock.ticker} />

            {yourShares > 0 && (
              <div className="ak-card p-4">
                <p className="mb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Your position</p>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-700 dark:text-stone-300">{yourShares} shares</span>
                  <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                    ≈ {Math.round(yourShares * spot)} pts
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
