import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import TabNav from '@/components/TabNav'
import StatsGraph, {
  type StatsGraphSeries,
  type StatsMetricData,
  type StatsMetricKey,
  type StatsMetricOption,
} from '@/components/StatsGraph'

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

  const [{ data: profile }, { data: profiles }, { data: bets }, { data: resolvedMarkets }, { data: transactions }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('profiles').select('id, username, points_balance').order('points_balance', { ascending: false }),
      supabase.from('bets').select('user_id, market_id, option, amount, created_at'),
      supabase.from('markets').select('id, resolved_option').not('resolved_option', 'is', null),
      supabase.from('transactions').select('user_id, amount, reason, created_at'),
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
  for (const txn of transactions ?? []) {
    if (!txn.reason.startsWith('Won market:')) continue
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
  const palette = ['#0f766e', '#14b8a6', '#0891b2', '#7c3aed', '#f97316', '#dc2626', '#4f46e5']

  const betsByUserSorted = new Map<string, { amount: number; marketId: string; option: string; createdAt: string }[]>()
  const txnsByUserSorted = new Map<string, { amount: number; reason: string; createdAt: string }[]>()

  for (const bet of bets ?? []) {
    if (!betsByUserSorted.has(bet.user_id)) betsByUserSorted.set(bet.user_id, [])
    betsByUserSorted.get(bet.user_id)!.push({
      amount: bet.amount,
      marketId: bet.market_id,
      option: bet.option,
      createdAt: bet.created_at,
    })
  }
  for (const txn of transactions ?? []) {
    if (!txnsByUserSorted.has(txn.user_id)) txnsByUserSorted.set(txn.user_id, [])
    txnsByUserSorted.get(txn.user_id)!.push({
      amount: txn.amount,
      reason: txn.reason,
      createdAt: txn.created_at,
    })
  }

  for (const userBets of betsByUserSorted.values()) {
    userBets.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }
  for (const userTxns of txnsByUserSorted.values()) {
    userTxns.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  const timeline = Array.from(
    new Set([
      ...(bets ?? []).map(bet => bet.created_at),
      ...(transactions ?? []).map(txn => txn.created_at),
    ])
  ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  const graphTimestamps = timeline.length > 0 ? timeline : [new Date().toISOString()]

  const metricOptions: StatsMetricOption[] = [
    {
      key: 'balance',
      label: 'Points balance',
      description: 'Balance over time for every player (default).',
      valueFormat: 'number',
    },
    {
      key: 'totalWagered',
      label: 'Total wagered',
      description: 'Cumulative points spent on bets.',
      valueFormat: 'number',
    },
    {
      key: 'totalBets',
      label: 'Total bets',
      description: 'Running count of bets placed.',
      valueFormat: 'number',
    },
    {
      key: 'marketsWon',
      label: 'Markets won',
      description: 'Running count of resolved markets each player won.',
      valueFormat: 'number',
    },
    {
      key: 'winRate',
      label: 'Win rate',
      description: 'Resolved-market win rate over time.',
      valueFormat: 'percent',
    },
  ]

  function normalizePoint(value: number | null): {
    value: number | null
    annotation: 'zero' | 'null' | null
  } {
    if (value === null) return { value: null, annotation: 'null' }
    if (value === 0) return { value: null, annotation: 'zero' }
    return { value, annotation: null }
  }

  function buildMetricSeries(metricKey: StatsMetricKey): StatsGraphSeries[] {
    return stats.map((stat, index) => {
      const userBets = betsByUserSorted.get(stat.id) ?? []
      const userTxns = txnsByUserSorted.get(stat.id) ?? []
      const txnSum = userTxns.reduce((sum, txn) => sum + txn.amount, 0)
      const startingBalance = stat.balance - txnSum

      let betPointer = 0
      let txnPointer = 0
      let runningBalance = startingBalance
      let runningWagered = 0
      let runningBets = 0
      const enteredMarkets = new Set<string>()
      const wonMarkets = new Set<string>()

      const points = graphTimestamps.map(timestamp => {
        const ts = new Date(timestamp).getTime()

        while (txnPointer < userTxns.length && new Date(userTxns[txnPointer].createdAt).getTime() <= ts) {
          runningBalance += userTxns[txnPointer].amount
          txnPointer += 1
        }

        while (betPointer < userBets.length && new Date(userBets[betPointer].createdAt).getTime() <= ts) {
          const bet = userBets[betPointer]
          runningBets += 1
          runningWagered += bet.amount
          if (resolvedMap.has(bet.marketId)) {
            enteredMarkets.add(bet.marketId)
            if (resolvedMap.get(bet.marketId) === bet.option) {
              wonMarkets.add(bet.marketId)
            }
          }
          betPointer += 1
        }

        let rawValue: number | null = null
        if (metricKey === 'balance') rawValue = runningBalance
        if (metricKey === 'totalWagered') rawValue = runningWagered
        if (metricKey === 'totalBets') rawValue = runningBets
        if (metricKey === 'marketsWon') rawValue = wonMarkets.size
        if (metricKey === 'winRate') {
          rawValue = enteredMarkets.size > 0 ? wonMarkets.size / enteredMarkets.size : null
        }

        const normalized = normalizePoint(rawValue)
        return {
          timestamp,
          value: normalized.value,
          annotation: normalized.annotation,
        }
      })

      return {
        userId: stat.id,
        username: stat.username,
        color: palette[index % palette.length],
        points,
      }
    })
  }

  const graphMetrics: StatsMetricData[] = metricOptions.map(option => ({
    option,
    series: buildMetricSeries(option.key),
  }))

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
    <div className="ak-page">
      <Navbar profile={profile} />

      <main className="ak-container py-8">
        <div className="flex items-center justify-between mb-0">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Stats</h1>
            <p className="mt-1 text-sm text-stone-500">All-time performance</p>
          </div>
        </div>

        <TabNav />

        <div className="mt-5 mb-5">
          <StatsGraph metrics={graphMetrics} defaultMetric="balance" />
        </div>

        <div className="ak-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100/90 bg-stone-50/60">
                <th className="ak-section-label px-4 py-3 text-left">#</th>
                <th className="ak-section-label px-4 py-3 text-left">Player</th>
                <th className="ak-section-label px-4 py-3 text-right">Balance</th>
                <th className="ak-section-label hidden px-4 py-3 text-right sm:table-cell">Wagered</th>
                <th className="ak-section-label hidden px-4 py-3 text-right sm:table-cell">Win rate</th>
                <th className="ak-section-label hidden px-4 py-3 text-right md:table-cell">Markets</th>
                <th className="ak-section-label hidden px-4 py-3 text-right md:table-cell">Best win</th>
                <th className="ak-section-label px-4 py-3 text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => {
                const isMe = s.id === user.id
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-stone-100/80 last:border-0 ${isMe ? 'bg-teal-50/80' : 'hover:bg-white/70'}`}
                  >
                    <td className="px-4 py-3 tabular-nums text-stone-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${isMe ? 'text-teal-700' : 'text-stone-800'}`}>
                        {s.username}
                        {isMe && <span className="ml-1.5 text-xs text-teal-500">you</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-800 tabular-nums">
                      {s.balance.toLocaleString()}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-stone-500 sm:table-cell">
                      {s.totalWagered > 0 ? s.totalWagered.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                      {s.winRate !== null ? (
                        <span className={s.winRate >= 0.5 ? 'font-medium text-teal-700' : 'text-stone-500'}>
                          {Math.round(s.winRate * 100)}%
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-stone-500 md:table-cell">
                      {s.marketsEntered > 0 ? (
                        <span>
                          <span className="font-medium text-stone-700">{s.marketsWon}</span>
                          <span className="text-stone-400">/{s.marketsEntered}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-stone-500 md:table-cell">
                      {s.biggestWin > 0 ? (
                        <span className="font-medium text-teal-700">+{s.biggestWin.toLocaleString()}</span>
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

        <p className="mt-3 text-xs text-stone-400">
          Win rate and P&L are calculated from resolved markets only.
        </p>
      </main>
    </div>
  )
}
