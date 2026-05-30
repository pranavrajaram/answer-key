import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { multiplierLabel } from '@/lib/stockEvents'
import Navbar from '@/components/Navbar'
import TabNav from '@/components/TabNav'

export const revalidate = 0

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type FeedItem =
  | { type: 'bet'; id: string; ts: string; username: string; isMe: boolean; amount: number; option: string; marketId: string; question: string }
  | { type: 'resolve'; id: string; ts: string; username: string; question: string; marketId: string; winner: string }
  | { type: 'trade'; id: string; ts: string; username: string; isMe: boolean; side: 'buy' | 'sell'; shares: number; cost: number; ticker: string; stockId: string }
  | { type: 'event'; id: string; ts: string; username: string; isMe: boolean; ticker: string; stockId: string; label: string; multiplier: number; dividend: number; status: string }

export default async function ActivityPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: bets }, { data: resolves }, { data: trades }, { data: events }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('bets')
        .select('id, option, amount, created_at, user_id, market_id, profiles(username), markets(id, question)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('markets')
        .select('id, question, resolved_option, created_at, profiles(username)')
        .not('resolved_option', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('stock_trades')
        .select('id, side, shares, cost, stock_id, user_id, created_at, profiles(username), stocks(ticker)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('stock_events')
        .select('id, label, multiplier, dividend_per_share, status, stock_id, proposed_by, created_at, stocks(ticker), profiles!stock_events_proposed_by_fkey(username)')
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  const feed: FeedItem[] = []

  for (const bet of bets ?? []) {
    const market = bet.markets as unknown as { id: string; question: string } | null
    const prof = bet.profiles as unknown as { username: string } | null
    if (!market) continue
    feed.push({
      type: 'bet', id: bet.id, ts: bet.created_at,
      username: prof?.username ?? 'someone', isMe: bet.user_id === user.id,
      amount: bet.amount, option: bet.option, marketId: market.id, question: market.question,
    })
  }

  for (const market of resolves ?? []) {
    const creator = market.profiles as unknown as { username: string } | null
    feed.push({
      type: 'resolve', id: market.id, ts: market.created_at,
      username: creator?.username ?? 'someone', question: market.question,
      marketId: market.id, winner: market.resolved_option!,
    })
  }

  for (const t of trades ?? []) {
    const prof = t.profiles as unknown as { username: string } | null
    const stock = t.stocks as unknown as { ticker: string } | null
    feed.push({
      type: 'trade', id: t.id, ts: t.created_at,
      username: prof?.username ?? 'someone', isMe: t.user_id === user.id,
      side: t.side, shares: t.shares, cost: t.cost,
      ticker: stock?.ticker ?? '???', stockId: t.stock_id,
    })
  }

  for (const e of events ?? []) {
    const prof = e.profiles as unknown as { username: string } | null
    const stock = e.stocks as unknown as { ticker: string } | null
    feed.push({
      type: 'event', id: e.id, ts: e.created_at,
      username: prof?.username ?? 'someone', isMe: e.proposed_by === user.id,
      ticker: stock?.ticker ?? '???', stockId: e.stock_id,
      label: e.label, multiplier: e.multiplier, dividend: e.dividend_per_share, status: e.status,
    })
  }

  feed.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  return (
    <div className="ak-page">
      <Navbar profile={profile} />

      <main className="ak-container py-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">Activity</h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">What everyone&apos;s been up to</p>
          </div>
        </div>

        <TabNav />

        <div className="max-w-2xl">
          {feed.length === 0 ? (
            <div className="ak-card p-8 text-center text-sm text-stone-400 dark:text-stone-500">
              No activity yet.
            </div>
          ) : (
            <div className="ak-card p-2 sm:p-3">
              {feed.map(item => {
                const isMe = 'isMe' in item && item.isMe
                const who = isMe ? 'You' : item.username
                const dot =
                  item.type === 'resolve'
                    ? 'bg-amber-400'
                    : item.type === 'trade'
                      ? item.side === 'buy' ? 'bg-teal-600' : 'bg-red-500'
                      : item.type === 'event'
                        ? item.multiplier > 1 ? 'bg-teal-600' : item.multiplier < 1 ? 'bg-red-500' : 'bg-violet-500'
                        : isMe ? 'bg-teal-600' : 'bg-stone-300 dark:bg-stone-600'

                return (
                  <div
                    key={item.type + item.id}
                    className="flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/70 dark:hover:bg-stone-800/40"
                  >
                    <div className="mt-1.5 shrink-0">
                      <div className={`h-2 w-2 rounded-full ${dot}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                        <span className={`font-semibold ${isMe ? 'text-teal-700 dark:text-teal-400' : 'text-stone-950 dark:text-stone-100'}`}>
                          {who}
                        </span>

                        {item.type === 'bet' && (
                          <>
                            {' bet '}
                            <span className="font-medium text-stone-950 dark:text-stone-100">{item.amount} pts</span>
                            {' on '}
                            <span className="font-medium text-stone-950 dark:text-stone-100">{item.option}</span>
                            {' in '}
                            <Link href={`/markets/${item.marketId}`} className="ak-link">{item.question}</Link>
                          </>
                        )}

                        {item.type === 'resolve' && (
                          <>
                            {' resolved '}
                            <Link href={`/markets/${item.marketId}`} className="ak-link">{item.question}</Link>
                            {' — winner: '}
                            <span className="font-medium text-amber-700 dark:text-amber-400">{item.winner}</span>
                          </>
                        )}

                        {item.type === 'trade' && (
                          <>
                            {item.side === 'buy' ? ' bought ' : ' sold '}
                            <span className="font-medium text-stone-950 dark:text-stone-100">
                              {item.shares} {item.shares === 1 ? 'share' : 'shares'}
                            </span>
                            {' of '}
                            <Link href={`/stocks/${item.stockId}`} className="ak-link font-mono">${item.ticker}</Link>
                            {' for '}
                            <span className="font-medium text-stone-950 dark:text-stone-100">{item.cost} pts</span>
                          </>
                        )}

                        {item.type === 'event' && (
                          <>
                            {' flagged '}
                            <Link href={`/stocks/${item.stockId}`} className="ak-link font-mono">${item.ticker}</Link>
                            {': '}
                            <span className="font-medium text-stone-950 dark:text-stone-100">{item.label}</span>
                            {' '}
                            <span className={item.multiplier > 1 ? 'text-teal-600 dark:text-teal-400' : item.multiplier < 1 ? 'text-red-500 dark:text-red-400' : 'text-stone-500'}>
                              ({multiplierLabel(item.multiplier)}{item.dividend > 0 ? ` · ${item.dividend} pts/share` : ''})
                            </span>
                            {item.status !== 'applied' && (
                              <span className="text-stone-400 dark:text-stone-500">
                                {item.status === 'rejected' ? ' · rejected' : ' · awaiting confirmation'}
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>

                    <span className="mt-0.5 shrink-0 text-xs text-stone-400 dark:text-stone-500">{timeAgo(item.ts)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
