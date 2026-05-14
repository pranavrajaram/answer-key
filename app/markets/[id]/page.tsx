import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Bet } from '@/lib/types'
import Navbar from '@/components/Navbar'
import ProbabilityBar from '@/components/ProbabilityBar'
import Countdown from '@/components/Countdown'
import BetPanel from '@/components/BetPanel'
import SellPanel from '@/components/SellPanel'
import Comments from '@/components/Comments'
import DeleteMarketButton from '@/components/DeleteMarketButton'

export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MarketPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: market }, { data: profile }, { data: bets }, { data: sells }, { data: comments }] =
    await Promise.all([
      supabase.from('markets').select('*, profiles(username)').eq('id', id).single(),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('bets').select('*, profiles(username)').eq('market_id', id).order('created_at', { ascending: false }),
      supabase.from('sells').select('*').eq('market_id', id).eq('user_id', user.id),
      supabase.from('comments').select('*, profiles(username)').eq('market_id', id).order('created_at', { ascending: false }),
    ])

  if (!market) notFound()

  const isCreator = market.creator_id === user.id
  const isResolved = !!market.resolved_option
  const isOpen = !isResolved && new Date(market.closes_at) > new Date()

  // Compute user's net position per option
  const myBets = (bets ?? []).filter((b: Bet) => b.user_id === user.id)
  const positions = market.options.map((opt: string) => {
    const bought = myBets.filter((b: Bet) => b.option === opt).reduce((s: number, b: Bet) => s + b.amount, 0)
    const sold = (sells ?? []).filter((s: { option: string }) => s.option === opt).reduce((sum: number, s: { shares: number }) => sum + s.shares, 0)
    return { option: opt, net: bought - sold }
  })
  const hasPositions = positions.some((p: { option: string; net: number }) => p.net > 0)

  const myTotalBet = myBets.reduce((s: number, b: Bet) => s + b.amount, 0)

  const betsByOption: Record<string, Bet[]> = {}
  if (bets) {
    for (const bet of bets) {
      if (!betsByOption[bet.option]) betsByOption[bet.option] = []
      betsByOption[bet.option].push(bet)
    }
  }
  const totalPot = (bets ?? []).reduce((s: number, b: Bet) => s + b.amount, 0)

  return (
    <div className="ak-page">
      <Navbar profile={profile} />

      <main className="ak-container py-6 sm:py-8">
        <div className="mb-5 flex items-center gap-2 text-sm text-stone-400 dark:text-stone-500">
          <Link href="/" className="transition-colors hover:text-stone-800 dark:hover:text-stone-200">
            Dashboard
          </Link>
          <span>/</span>
          <span className="max-w-xs truncate text-stone-600 dark:text-stone-300">{market.question}</span>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
          {/* Left: market info + comments */}
          <div className="space-y-5 xl:col-span-2">
            <div className="ak-card p-4 sm:p-6">
              <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
                <h1 className="text-xl font-semibold leading-snug tracking-tight text-stone-950 dark:text-stone-100">
                  {market.question}
                </h1>
                {isResolved ? (
                  <span className="ak-badge bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
                    Resolved: {market.resolved_option}
                  </span>
                ) : isOpen ? (
                  <Countdown closesAt={market.closes_at} />
                ) : (
                  <span className="ak-badge bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300">
                    Awaiting resolution
                  </span>
                )}
              </div>

              <ProbabilityBar
                options={market.options}
                qValues={market.q_values}
                b={market.b}
              />

              <div className="mt-4 flex flex-col gap-1 border-t border-stone-200/70 pt-4 text-xs leading-relaxed text-stone-400 sm:flex-row sm:items-center sm:justify-between dark:border-stone-700/60 dark:text-stone-500">
                <span>
                  Created by{' '}
                  <span className="font-medium text-stone-600 dark:text-stone-300">
                    {market.profiles?.username ?? 'unknown'}
                  </span>
                </span>
                <span>{totalPot} pts in pool · {(bets ?? []).length} bets</span>
              </div>
            </div>

            {/* Resolved payout breakdown */}
            {isResolved && (
              <div className="ak-card p-4 sm:p-6">
                <h2 className="mb-4 font-semibold text-stone-900 dark:text-stone-100">Resolution</h2>
                <div className="space-y-3">
                  {market.options.map((opt: string) => {
                    const optBets = betsByOption[opt] ?? []
                    const optTotal = optBets.reduce((s: number, b: Bet) => s + b.amount, 0)
                    const isWinner = opt === market.resolved_option

                    return (
                      <div
                        key={opt}
                        className={`rounded-xl p-3 ${
                          isWinner
                            ? 'border border-teal-200 bg-teal-50 dark:border-teal-800/50 dark:bg-teal-950/25'
                            : 'bg-stone-50/80 dark:bg-stone-900/40'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span
                            className={`text-sm font-medium ${isWinner ? 'text-teal-800 dark:text-teal-300' : 'text-stone-600 dark:text-stone-400'}`}
                          >
                            {opt} {isWinner && '✓'}
                          </span>
                          <span className="text-xs text-stone-500 dark:text-stone-500">{optTotal} pts</span>
                        </div>
                        {isWinner && optBets.length > 0 && (
                          <div className="space-y-1">
                            {optBets.map((b: Bet) => {
                              const payout = optTotal > 0 ? Math.round((b.amount / optTotal) * totalPot) : 0
                              return (
                                <div key={b.id} className="flex justify-between text-xs text-teal-700 dark:text-teal-400">
                                  <span>{b.profiles?.username ?? 'unknown'}</span>
                                  <span className="font-medium">+{payout} pts</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Bet history */}
            {(bets ?? []).length > 0 && (
              <div className="ak-card p-4 sm:p-6">
                <h2 className="mb-4 font-semibold text-stone-900 dark:text-stone-100">Recent bets</h2>
                <div className="space-y-2">
                  {(bets ?? []).slice(0, 20).map((b: Bet) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between border-b border-stone-100/80 py-1.5 text-sm last:border-0 dark:border-stone-800/80"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium ${b.user_id === user.id ? 'text-teal-700 dark:text-teal-400' : 'text-stone-600 dark:text-stone-400'}`}
                        >
                          {b.profiles?.username ?? 'unknown'}
                          {b.user_id === user.id && (
                            <span className="ml-1 text-stone-400 dark:text-stone-500">you</span>
                          )}
                        </span>
                        <span className="text-stone-400 dark:text-stone-500">bet on</span>
                        <span className="font-medium text-stone-700 dark:text-stone-300">{b.option}</span>
                      </div>
                      <span className="tabular-nums text-stone-500 dark:text-stone-400">{b.amount} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <Comments
              marketId={market.id}
              currentUserId={user.id}
              initialComments={comments ?? []}
            />
          </div>

          {/* Right: actions sidebar */}
          <div className="space-y-4 xl:col-span-1">
            {isOpen && profile && (
              <BetPanel market={market} profile={profile} />
            )}

            {isOpen && hasPositions && (
              <SellPanel market={market} positions={positions} />
            )}

            {isCreator && !isResolved && (
              <Link
                href={`/markets/${market.id}/resolve`}
                className="ak-button-secondary block py-3 text-center"
              >
                Resolve this market →
              </Link>
            )}

            {isCreator && !isResolved && (
              <DeleteMarketButton marketId={market.id} />
            )}

            {myBets.length > 0 && (
              <div className="ak-card p-4">
                <p className="mb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">Your positions</p>
                <div className="space-y-1.5">
                  {positions.filter((p: { option: string; net: number }) => p.net > 0 || myBets.some((b: Bet) => b.option === p.option)).map((p: { option: string; net: number }) => (
                    <div key={p.option} className="flex justify-between text-sm">
                      <span className="text-stone-700 dark:text-stone-300">{p.option}</span>
                      <span className="font-medium text-stone-900 tabular-nums dark:text-stone-100">
                        {p.net > 0 ? (
                          `${p.net} shares`
                        ) : (
                          <span className="text-stone-400 dark:text-stone-500">sold out</span>
                        )}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-stone-200/70 pt-1.5 text-xs text-stone-500 dark:border-stone-700/60 dark:text-stone-400">
                    <span>Total spent</span>
                    <span className="font-semibold">{myTotalBet} pts</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
