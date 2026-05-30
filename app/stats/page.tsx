import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { spotPrice } from '@/lib/stockMarket'
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
  stockValue: number
  netWorth: number
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

  const [
    { data: profile },
    { data: profiles },
    { data: bets },
    { data: resolvedMarkets },
    { data: transactions },
    { data: stocks },
    { data: holdings },
    { data: stockTrades },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('profiles').select('id, username, points_balance').order('points_balance', { ascending: false }),
    supabase.from('bets').select('user_id, market_id, option, amount, created_at'),
    supabase.from('markets').select('id, resolved_option').not('resolved_option', 'is', null),
    supabase.from('transactions').select('user_id, amount, reason, created_at'),
    supabase.from('stocks').select('id, base_price, slope, shares_outstanding'),
    supabase.from('stock_holdings').select('user_id, stock_id, shares'),
    supabase
      .from('stock_trades')
      .select('user_id, stock_id, side, shares, spot_after, created_at')
      .order('created_at', { ascending: true }),
  ])

  // Current mark-to-market stock value per user (for net worth + a stats column).
  const spotByStock = new Map<string, number>()
  for (const s of stocks ?? []) {
    spotByStock.set(s.id, spotPrice(s.base_price, s.slope, s.shares_outstanding))
  }
  const stockValueByUser = new Map<string, number>()
  for (const h of holdings ?? []) {
    if (h.shares <= 0) continue
    stockValueByUser.set(
      h.user_id,
      (stockValueByUser.get(h.user_id) ?? 0) + h.shares * (spotByStock.get(h.stock_id) ?? 0)
    )
  }

  // Index resolved markets
  const resolvedMap = new Map((resolvedMarkets ?? []).map(m => [m.id, m.resolved_option as string]))

  // Compute per-user stats
  const statsMap = new Map<string, UserStats>()

  for (const p of profiles ?? []) {
    const stockValue = Math.round(stockValueByUser.get(p.id) ?? 0)
    statsMap.set(p.id, {
      id: p.id,
      username: p.username,
      balance: p.points_balance,
      stockValue,
      netWorth: p.points_balance + stockValue,
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

  const stats = [...statsMap.values()].sort((a, b) => b.netWorth - a.netWorth)
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

  // Per-user stock trades (chronological) for reconstructing share holdings over
  // time. spot_after captures the price right after each trade, so we use it as
  // the best-known mark for that stock up until the next trade.
  interface TradePoint { stockId: string; side: 'buy' | 'sell'; shares: number; spotAfter: number; createdAt: string }
  const tradesByUser = new Map<string, TradePoint[]>()
  const lastSpotByStock = new Map<string, { ts: number; spot: number }[]>()
  for (const t of stockTrades ?? []) {
    if (!tradesByUser.has(t.user_id)) tradesByUser.set(t.user_id, [])
    tradesByUser.get(t.user_id)!.push({
      stockId: t.stock_id, side: t.side, shares: t.shares, spotAfter: t.spot_after, createdAt: t.created_at,
    })
    if (!lastSpotByStock.has(t.stock_id)) lastSpotByStock.set(t.stock_id, [])
    lastSpotByStock.get(t.stock_id)!.push({ ts: new Date(t.created_at).getTime(), spot: t.spot_after })
  }

  // Spot price of a stock at a given time = price after the most recent trade
  // at or before that time, else the stock's current spot (covers no-trade gaps).
  function spotAt(stockId: string, ts: number): number {
    const hist = lastSpotByStock.get(stockId)
    if (hist && hist.length) {
      let best = hist[0].spot
      for (const h of hist) {
        if (h.ts <= ts) best = h.spot
        else break
      }
      return best
    }
    return spotByStock.get(stockId) ?? 0
  }

  const timeline = Array.from(
    new Set([
      ...(bets ?? []).map(bet => bet.created_at),
      ...(transactions ?? []).map(txn => txn.created_at),
      ...(stockTrades ?? []).map(t => t.created_at),
    ])
  ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  const graphTimestamps = timeline.length > 0 ? timeline : [new Date().toISOString()]

  const metricOptions: StatsMetricOption[] = [
    {
      key: 'balance',
      label: 'Points balance',
      description: 'Liquid points balance over time for every player.',
      valueFormat: 'number',
    },
    {
      key: 'netWorth',
      label: 'Net worth',
      description: 'Liquid points plus the market value of stock holdings over time.',
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
      const userTrades = tradesByUser.get(stat.id) ?? []
      const txnSum = userTxns.reduce((sum, txn) => sum + txn.amount, 0)
      const startingBalance = stat.balance - txnSum

      let betPointer = 0
      let txnPointer = 0
      let tradePointer = 0
      let runningBalance = startingBalance
      let runningWagered = 0
      let runningBets = 0
      const enteredMarkets = new Set<string>()
      const wonMarkets = new Set<string>()
      const heldShares = new Map<string, number>() // stockId → shares held

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

        while (tradePointer < userTrades.length && new Date(userTrades[tradePointer].createdAt).getTime() <= ts) {
          const tr = userTrades[tradePointer]
          const delta = tr.side === 'buy' ? tr.shares : -tr.shares
          heldShares.set(tr.stockId, (heldShares.get(tr.stockId) ?? 0) + delta)
          tradePointer += 1
        }

        let rawValue: number | null = null
        if (metricKey === 'balance') rawValue = runningBalance
        if (metricKey === 'netWorth') {
          let stockVal = 0
          for (const [stockId, shares] of heldShares) {
            if (shares > 0) stockVal += shares * spotAt(stockId, ts)
          }
          rawValue = runningBalance + stockVal
        }
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
    if (n > 0) return 'text-teal-600 dark:text-teal-400'
    if (n < 0) return 'text-red-500 dark:text-red-400'
    return 'text-gray-400 dark:text-stone-500'
  }

  function plFormat(n: number) {
    if (n === 0) return '—'
    return `${n > 0 ? '+' : ''}${n.toLocaleString()}`
  }

  return (
    <div className="ak-page">
      <Navbar profile={profile} />

      <main className="ak-container py-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">Stats</h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">All-time performance</p>
          </div>
        </div>

        <TabNav />

        <div className="mb-5">
          <StatsGraph metrics={graphMetrics} defaultMetric="balance" />
        </div>

        <div className="ak-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100/90 bg-stone-50/60 dark:border-stone-700/60 dark:bg-stone-900/50">
                <th className="ak-section-label px-4 py-3 text-left">#</th>
                <th className="ak-section-label px-4 py-3 text-left">Player</th>
                <th className="ak-section-label px-4 py-3 text-right">Balance</th>
                <th className="ak-section-label hidden px-4 py-3 text-right sm:table-cell">Stocks</th>
                <th className="ak-section-label px-4 py-3 text-right">Net worth</th>
                <th className="ak-section-label hidden px-4 py-3 text-right lg:table-cell">Wagered</th>
                <th className="ak-section-label hidden px-4 py-3 text-right sm:table-cell">Win rate</th>
                <th className="ak-section-label hidden px-4 py-3 text-right md:table-cell">Markets</th>
                <th className="ak-section-label hidden px-4 py-3 text-right md:table-cell">Best win</th>
                <th className="ak-section-label hidden px-4 py-3 text-right lg:table-cell">Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => {
                const isMe = s.id === user.id
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-stone-100/80 last:border-0 dark:border-stone-700/50 ${
                      isMe ? 'bg-teal-50/80 dark:bg-teal-950/25' : 'hover:bg-white/70 dark:hover:bg-stone-800/35'
                    }`}
                  >
                    <td className="px-4 py-3 tabular-nums text-stone-400 dark:text-stone-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${isMe ? 'text-teal-700 dark:text-teal-400' : 'text-stone-800 dark:text-stone-200'}`}
                      >
                        {s.username}
                        {isMe && <span className="ml-1.5 text-xs text-teal-500 dark:text-teal-400">you</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-800 tabular-nums dark:text-stone-100">
                      {s.balance.toLocaleString()}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-stone-500 sm:table-cell dark:text-stone-400">
                      {s.stockValue > 0 ? s.stockValue.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-stone-800 dark:text-stone-100">
                      {s.netWorth.toLocaleString()}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-stone-500 lg:table-cell dark:text-stone-400">
                      {s.totalWagered > 0 ? s.totalWagered.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                      {s.winRate !== null ? (
                        <span
                          className={
                            s.winRate >= 0.5 ? 'font-medium text-teal-700 dark:text-teal-400' : 'text-stone-500 dark:text-stone-400'
                          }
                        >
                          {Math.round(s.winRate * 100)}%
                        </span>
                      ) : (
                        <span className="text-stone-300 dark:text-stone-600">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-stone-500 md:table-cell dark:text-stone-400">
                      {s.marketsEntered > 0 ? (
                        <span>
                          <span className="font-medium text-stone-700 dark:text-stone-300">{s.marketsWon}</span>
                          <span className="text-stone-400 dark:text-stone-500">/{s.marketsEntered}</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-stone-500 md:table-cell dark:text-stone-400">
                      {s.biggestWin > 0 ? (
                        <span className="font-medium text-teal-700 dark:text-teal-400">
                          +{s.biggestWin.toLocaleString()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`hidden px-4 py-3 text-right font-semibold tabular-nums lg:table-cell ${plColor(s.netPL)}`}>
                      {plFormat(s.netPL)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
          Net worth = points balance + current stock holdings. Win rate and P&L are calculated from resolved markets only.
        </p>
      </main>
    </div>
  )
}
