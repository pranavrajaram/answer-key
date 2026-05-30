import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Market } from '@/lib/types'
import { spotPrice } from '@/lib/stockMarket'
import Navbar from '@/components/Navbar'
import MarketCard from '@/components/MarketCard'
import LeaderboardWithPortfolio from '@/components/LeaderboardWithPortfolio'
import TabNav from '@/components/TabNav'
import RoutePrefetcher from '@/components/RoutePrefetcher'

interface BetRow {
  user_id: string
  market_id: string
  option: string
  amount: number
}

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: markets },
    { data: allBets },
    { data: allProfiles },
    { data: allStocks },
    { data: allHoldings },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('markets').select('*, profiles(username)').order('created_at', { ascending: false }),
    supabase.from('bets').select('user_id, market_id, option, amount'),
    supabase.from('profiles').select('id, username, points_balance'),
    supabase.from('stocks').select('id, base_price, slope, shares_outstanding'),
    supabase.from('stock_holdings').select('user_id, stock_id, shares'),
  ])

  // Leaderboard score = liquid points + market value of stock holdings.
  const spotByStock: Record<string, number> = {}
  for (const s of (allStocks ?? []) as {
    id: string
    base_price: number
    slope: number
    shares_outstanding: number
  }[]) {
    spotByStock[s.id] = spotPrice(s.base_price, s.slope, s.shares_outstanding)
  }
  const stockValueByUser: Record<string, number> = {}
  for (const h of (allHoldings ?? []) as { user_id: string; stock_id: string; shares: number }[]) {
    if (h.shares <= 0) continue
    stockValueByUser[h.user_id] =
      (stockValueByUser[h.user_id] ?? 0) + h.shares * (spotByStock[h.stock_id] ?? 0)
  }
  const leaderboard = ((allProfiles ?? []) as { id: string; username: string; points_balance: number }[])
    .map(p => {
      const stockValue = Math.round(stockValueByUser[p.id] ?? 0)
      return {
        id: p.id,
        username: p.username,
        points_balance: p.points_balance,
        stockValue,
        netWorth: p.points_balance + stockValue,
      }
    })
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, 10)

  const openMarkets = (markets ?? []).filter(
    (m: Market) => !m.resolved_option && new Date(m.closes_at) > new Date()
  )
  const closedUnresolved = (markets ?? []).filter(
    (m: Market) => !m.resolved_option && new Date(m.closes_at) <= new Date()
  )
  const resolvedMarkets = (markets ?? []).filter((m: Market) => !!m.resolved_option)

  const myBets = (allBets ?? []).filter((b: BetRow) => b.user_id === user.id)

  const participatedResolved = resolvedMarkets.filter((m: Market) =>
    myBets.some((b: BetRow) => b.market_id === m.id)
  )

  // Build portfolio map: userId → open positions
  const activeMarketIds = new Set([
    ...openMarkets.map((m: Market) => m.id),
    ...closedUnresolved.map((m: Market) => m.id),
  ])
  const marketById = Object.fromEntries((markets ?? []).map((m: Market) => [m.id, m]))

  const portfolios: Record<string, { marketId: string; question: string; options: string[] }[]> = {}
  for (const bet of (allBets ?? []) as BetRow[]) {
    if (!activeMarketIds.has(bet.market_id)) continue
    const market = marketById[bet.market_id]
    if (!market) continue
    if (!portfolios[bet.user_id]) portfolios[bet.user_id] = []
    const existing = portfolios[bet.user_id].find(p => p.marketId === bet.market_id)
    if (existing) {
      if (!existing.options.includes(bet.option)) existing.options.push(bet.option)
    } else {
      portfolios[bet.user_id].push({ marketId: bet.market_id, question: market.question, options: [bet.option] })
    }
  }

  return (
    <div className="ak-page">
      <Navbar profile={profile} />
      <RoutePrefetcher
        hrefs={(markets ?? []).slice(0, 12).map((market: Market) => `/markets/${market.id}`)}
      />

      <main className="ak-container space-y-6 py-6 sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">Markets</h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Welcome back, {profile?.username}</p>
          </div>
          <Link
            href="/markets/new"
            className="ak-button-primary"
          >
            New market
          </Link>
        </div>

        <TabNav />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
          <div className="space-y-6 xl:col-span-2">
            <section>
              <h2 className="ak-section-label mb-3">
                Open ({openMarkets.length})
              </h2>
              {openMarkets.length === 0 ? (
                <div className="ak-card p-8 text-center text-sm text-stone-400 dark:text-stone-500">
                  No open markets yet.{' '}
                  <Link href="/markets/new" className="ak-link">
                    Create one
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {openMarkets.map((market: Market) => (
                    <MarketCard key={market.id} market={market} />
                  ))}
                </div>
              )}
            </section>

            {closedUnresolved.length > 0 && (
              <section>
                <h2 className="ak-section-label mb-3">
                  Awaiting Resolution ({closedUnresolved.length})
                </h2>
                <div className="space-y-3">
                  {closedUnresolved.map((market: Market) => (
                    <MarketCard key={market.id} market={market} />
                  ))}
                </div>
              </section>
            )}

            {participatedResolved.length > 0 && (
              <section>
                <h2 className="ak-section-label mb-3">
                  Your Resolved Markets
                </h2>
                <div className="space-y-3">
                  {participatedResolved.map((market: Market) => {
                    const bets = myBets.filter((b: BetRow) => b.market_id === market.id)
                    const totalSpent = bets.reduce((s: number, b: BetRow) => s + b.amount, 0)
                    const won = bets.some((b: BetRow) => b.option === market.resolved_option)

                    return (
                      <Link key={market.id} href={`/markets/${market.id}`}>
                        <div className="ak-card ak-card-hover p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{market.question}</p>
                              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                                Winner:{' '}
                                <span className="font-medium text-stone-700 dark:text-stone-300">{market.resolved_option}</span>
                                {' · '}Bet {totalSpent} pts on{' '}
                                {bets.map((b: BetRow) => b.option).join(', ')}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                                won
                                  ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300'
                                  : 'bg-red-50 text-red-600 dark:bg-red-950/35 dark:text-red-400'
                              }`}
                            >
                              {won ? '✓ Won' : `−${totalSpent}`}
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}
          </div>

          <div className="xl:col-span-1">
            <h2 className="ak-section-label mb-3">
              Leaderboard
            </h2>
            <LeaderboardWithPortfolio
              leaderboard={leaderboard ?? []}
              portfolios={portfolios}
              currentUserId={user.id}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
