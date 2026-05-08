import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Bet, Profile } from '@/lib/types'
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
    <div className="min-h-screen bg-stone-50">
      <Navbar profile={profile} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/" className="hover:text-gray-700 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-gray-600 truncate max-w-xs">{market.question}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: market info + comments */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <h1 className="text-lg font-semibold text-gray-900 leading-snug">
                  {market.question}
                </h1>
                {isResolved ? (
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full whitespace-nowrap">
                    Resolved: {market.resolved_option}
                  </span>
                ) : isOpen ? (
                  <Countdown closesAt={market.closes_at} />
                ) : (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full whitespace-nowrap">
                    Awaiting resolution
                  </span>
                )}
              </div>

              <ProbabilityBar
                options={market.options}
                qValues={market.q_values}
                b={market.b}
              />

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>
                  Created by{' '}
                  <span className="text-gray-600 font-medium">
                    {market.profiles?.username ?? 'unknown'}
                  </span>
                </span>
                <span>{totalPot} pts in pool · {(bets ?? []).length} bets</span>
              </div>
            </div>

            {/* Resolved payout breakdown */}
            {isResolved && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Resolution</h2>
                <div className="space-y-3">
                  {market.options.map((opt: string) => {
                    const optBets = betsByOption[opt] ?? []
                    const optTotal = optBets.reduce((s: number, b: Bet) => s + b.amount, 0)
                    const isWinner = opt === market.resolved_option

                    return (
                      <div
                        key={opt}
                        className={`rounded-lg p-3 ${isWinner ? 'bg-teal-50 border border-teal-200' : 'bg-gray-50'}`}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-sm font-medium ${isWinner ? 'text-teal-800' : 'text-gray-600'}`}>
                            {opt} {isWinner && '✓'}
                          </span>
                          <span className="text-xs text-gray-500">{optTotal} pts</span>
                        </div>
                        {isWinner && optBets.length > 0 && (
                          <div className="space-y-1">
                            {optBets.map((b: Bet) => {
                              const payout = optTotal > 0 ? Math.round((b.amount / optTotal) * totalPot) : 0
                              return (
                                <div key={b.id} className="flex justify-between text-xs text-teal-700">
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
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Recent bets</h2>
                <div className="space-y-2">
                  {(bets ?? []).slice(0, 20).map((b: Bet) => (
                    <div key={b.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${b.user_id === user.id ? 'text-teal-700' : 'text-gray-600'}`}>
                          {b.profiles?.username ?? 'unknown'}
                          {b.user_id === user.id && <span className="text-gray-400 ml-1">you</span>}
                        </span>
                        <span className="text-gray-400">bet on</span>
                        <span className="font-medium text-gray-700">{b.option}</span>
                      </div>
                      <span className="text-gray-500 tabular-nums">{b.amount} pts</span>
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
          <div className="lg:col-span-1 space-y-4">
            {isOpen && profile && (
              <BetPanel market={market} profile={profile} />
            )}

            {isOpen && hasPositions && (
              <SellPanel market={market} positions={positions} />
            )}

            {isCreator && !isResolved && (
              <Link
                href={`/markets/${market.id}/resolve`}
                className="block text-center bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-medium py-3 rounded-xl transition-colors"
              >
                Resolve this market →
              </Link>
            )}

            {isCreator && !isResolved && (
              <DeleteMarketButton marketId={market.id} />
            )}

            {myBets.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Your positions</p>
                <div className="space-y-1.5">
                  {positions.filter((p: { option: string; net: number }) => p.net > 0 || myBets.some((b: Bet) => b.option === p.option)).map((p: { option: string; net: number }) => (
                    <div key={p.option} className="flex justify-between text-sm">
                      <span className="text-gray-700">{p.option}</span>
                      <span className="font-medium text-gray-900 tabular-nums">
                        {p.net > 0 ? `${p.net} shares` : <span className="text-gray-400">sold out</span>}
                      </span>
                    </div>
                  ))}
                  <div className="pt-1.5 border-t border-gray-100 flex justify-between text-xs text-gray-500">
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
