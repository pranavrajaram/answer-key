import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Market, Profile } from '@/lib/types'
import Navbar from '@/components/Navbar'
import MarketCard from '@/components/MarketCard'
import LeaderboardWithPortfolio from '@/components/LeaderboardWithPortfolio'
import TabNav from '@/components/TabNav'

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

  const [{ data: profile }, { data: markets }, { data: allBets }, { data: leaderboard }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('markets').select('*, profiles(username)').order('created_at', { ascending: false }),
      supabase.from('bets').select('user_id, market_id, option, amount'),
      supabase
        .from('profiles')
        .select('id, username, points_balance')
        .order('points_balance', { ascending: false })
        .limit(10),
    ])

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
    <div className="min-h-screen">
      <Navbar profile={profile} />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Markets</h1>
            <p className="text-sm text-gray-500 mt-0.5">Welcome back, {profile?.username}</p>
          </div>
          <Link
            href="/markets/new"
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            New market
          </Link>
        </div>

        <TabNav />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Open ({openMarkets.length})
              </h2>
              {openMarkets.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
                  No open markets yet.{' '}
                  <Link href="/markets/new" className="text-teal-600 hover:underline">
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
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
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
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                  Your Resolved Markets
                </h2>
                <div className="space-y-3">
                  {participatedResolved.map((market: Market) => {
                    const bets = myBets.filter((b: BetRow) => b.market_id === market.id)
                    const totalSpent = bets.reduce((s: number, b: BetRow) => s + b.amount, 0)
                    const won = bets.some((b: BetRow) => b.option === market.resolved_option)

                    return (
                      <Link key={market.id} href={`/markets/${market.id}`}>
                        <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-all">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{market.question}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Winner:{' '}
                                <span className="text-gray-700 font-medium">{market.resolved_option}</span>
                                {' · '}Bet {totalSpent} pts on{' '}
                                {bets.map((b: BetRow) => b.option).join(', ')}
                              </p>
                            </div>
                            <span
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                                won ? 'text-teal-700 bg-teal-50' : 'text-red-600 bg-red-50'
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

          <div className="lg:col-span-1">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
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
