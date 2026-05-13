import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import TabNav from '@/components/TabNav'

export const revalidate = 0

interface UserStats {
  id: string
  username: string
  balance: number
  totalWagered: number
  totalEarned: number
  netPL: number
  marketsEntered: number
  marketsWon: number
  winRate: number | null
  biggestWin: number
}

export default async function StatsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: profiles }, { data: bets }, { data: resolvedMarkets }, { data: winTxns }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('profiles').select('id, username, points_balance').order('points_balance', { ascending: false }),
      supabase.from('bets').select('user_id, market_id, option, amount'),
      supabase.from('markets').select('id, resolved_option').not('resolved_option', 'is', null),
      supabase
        .from('transactions')
        .select('user_id, amount')
        .ilike('reason', 'Won market:%'),
    ])

  // Index resolved markets
  const resolvedMap = new Map((resolvedMarkets ?? []).map(m => [m.id, m.resolved_option as string]))

  // Compute per-user stats
  const statsMap = new Map<string, UserStats>()

  for (const p of profiles ?? []) {
    statsMap.set(p.id, {
      id: p.id,
      username: p.username,
      balance: p.points_balance,
      totalWagered: 0,
      totalEarned: 0,
      netPL: 0,
      marketsEntered: 0,
      marketsWon: 0,
      winRate: null,
      biggestWin: 0,
    })
  }

  // Tally bets
  const betsByUser = new Map<string, { marketId: string; option: string; amount: number }[]>()
  for (const bet of bets ?? []) {
    if (!betsByUser.has(bet.user_id)) betsByUser.set(bet.user_id, [])
    betsByUser.get(bet.user_id)!.push({ marketId: bet.market_id, option: bet.option, amount: bet.amount })
  }

  for (const [userId, userBets] of betsByUser) {
    const s = statsMap.get(userId)
    if (!s) continue

    // Total wagered across all markets
    s.totalWagered = userBets.reduce((sum, b) => sum + b.amount, 0)

    // Per resolved market: entered and won
    const resolvedBets = userBets.filter(b => resolvedMap.has(b.marketId))
    const enteredMarkets = new Set(resolvedBets.map(b => b.marketId))
    const wonMarkets = new Set(
      resolvedBets.filter(b => resolvedMap.get(b.marketId) === b.option).map(b => b.marketId)
    )

    s.marketsEntered = enteredMarkets.size
    s.marketsWon = wonMarkets.size
    s.winRate = enteredMarkets.size > 0 ? wonMarkets.size / enteredMarkets.size : null
  }

  // Tally winnings from transactions
  for (const txn of winTxns ?? []) {
    const s = statsMap.get(txn.user_id)
    if (!s) continue
    s.totalEarned += txn.amount
    if (txn.amount > s.biggestWin) s.biggestWin = txn.amount
  }

  // Net P&L = earned - wagered on resolved markets only
  for (const s of statsMap.values()) {
    const userBets = betsByUser.get(s.id) ?? []
    const wageredOnResolved = userBets
      .filter(b => resolvedMap.has(b.marketId))
      .reduce((sum, b) => sum + b.amount, 0)
    s.netPL = s.totalEarned - wageredOnResolved
  }

  const stats = [...statsMap.values()].sort((a, b) => b.balance - a.balance)

  function plColor(n: number) {
    if (n > 0) return 'text-teal-600'
    if (n < 0) return 'text-red-500'
    return 'text-gray-400'
  }

  function plFormat(n: number) {
    if (n === 0) return '—'
    return `${n > 0 ? '+' : ''}${n.toLocaleString()}`
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar profile={profile} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-0">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Stats</h1>
            <p className="text-sm text-gray-500 mt-0.5">All-time performance</p>
          </div>
        </div>

        <TabNav />

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Player</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Balance</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Wagered</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Win rate</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Markets</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Best win</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => {
                const isMe = s.id === user.id
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-50 last:border-0 ${isMe ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3 text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${isMe ? 'text-teal-700' : 'text-gray-800'}`}>
                        {s.username}
                        {isMe && <span className="text-xs text-teal-400 ml-1.5">you</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">
                      {s.balance.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums hidden sm:table-cell">
                      {s.totalWagered > 0 ? s.totalWagered.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                      {s.winRate !== null ? (
                        <span className={s.winRate >= 0.5 ? 'text-teal-600 font-medium' : 'text-gray-500'}>
                          {Math.round(s.winRate * 100)}%
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums hidden md:table-cell">
                      {s.marketsEntered > 0 ? (
                        <span>
                          <span className="font-medium text-gray-700">{s.marketsWon}</span>
                          <span className="text-gray-400">/{s.marketsEntered}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums hidden md:table-cell">
                      {s.biggestWin > 0 ? (
                        <span className="text-teal-600 font-medium">+{s.biggestWin.toLocaleString()}</span>
                      ) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${plColor(s.netPL)}`}>
                      {plFormat(s.netPL)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Win rate and P&L are calculated from resolved markets only.
        </p>
      </main>
    </div>
  )
}
