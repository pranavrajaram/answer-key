import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
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

export default async function ActivityPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: bets }, { data: resolves }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('bets')
      .select('id, option, amount, created_at, user_id, market_id, profiles(username), markets(id, question, resolved_option)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('markets')
      .select('id, question, resolved_option, creator_id, updated_at:created_at, profiles(username)')
      .not('resolved_option', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  // Merge bets and resolutions into one timeline, sorted by date
  type FeedItem =
    | { type: 'bet'; id: string; ts: string; userId: string; username: string; amount: number; option: string; marketId: string; question: string; isMe: boolean }
    | { type: 'resolve'; id: string; ts: string; username: string; question: string; marketId: string; winner: string }

  const feed: FeedItem[] = []

  for (const bet of bets ?? []) {
    const market = (bet.markets as unknown) as { id: string; question: string; resolved_option: string | null } | null
    const profile_ = (bet.profiles as unknown) as { username: string } | null
    if (!market) continue
    feed.push({
      type: 'bet',
      id: bet.id,
      ts: bet.created_at,
      userId: bet.user_id,
      username: profile_?.username ?? 'unknown',
      amount: bet.amount,
      option: bet.option,
      marketId: market.id,
      question: market.question,
      isMe: bet.user_id === user.id,
    })
  }

  for (const market of resolves ?? []) {
    const creator = (market.profiles as unknown) as { username: string } | null
    feed.push({
      type: 'resolve',
      id: market.id,
      ts: market.updated_at,
      username: creator?.username ?? 'unknown',
      question: market.question,
      marketId: market.id,
      winner: market.resolved_option!,
    })
  }

  feed.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  return (
    <div className="ak-page">
      <Navbar profile={profile} />

      <main className="ak-container py-8">
        <div className="flex items-center justify-between mb-0">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950">Activity</h1>
            <p className="mt-1 text-sm text-stone-500">What everyone&apos;s been up to</p>
          </div>
        </div>

        <TabNav />

        <div className="max-w-xl">
          {feed.length === 0 ? (
            <div className="ak-card p-8 text-center text-sm text-stone-400">
              No activity yet.
            </div>
          ) : (
            <div className="ak-card p-3">
              {feed.map(item => (
                <div key={item.type + item.id} className="flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/70">
                  {/* Dot */}
                  <div className="mt-1.5 shrink-0">
                    {item.type === 'bet' ? (
                      <div className={`h-2 w-2 rounded-full ${item.isMe ? 'bg-teal-600' : 'bg-stone-300'}`} />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-amber-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {item.type === 'bet' ? (
                      <p className="text-sm leading-snug text-stone-700">
                        <span className={`font-semibold ${item.isMe ? 'text-teal-700' : 'text-stone-950'}`}>
                          {item.isMe ? 'You' : item.username}
                        </span>
                        {' bet '}
                        <span className="font-medium text-stone-950">{item.amount} pts</span>
                        {' on '}
                        <span className="font-medium text-stone-950">{item.option}</span>
                        {' in '}
                        <Link href={`/markets/${item.marketId}`} className="ak-link">
                          {item.question}
                        </Link>
                      </p>
                    ) : (
                      <p className="text-sm leading-snug text-stone-700">
                        <span className="font-semibold text-stone-950">{item.username}</span>
                        {' resolved '}
                        <Link href={`/markets/${item.marketId}`} className="ak-link">
                          {item.question}
                        </Link>
                        {' — winner: '}
                        <span className="font-medium text-amber-700">{item.winner}</span>
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <span className="mt-0.5 shrink-0 text-xs text-stone-400">{timeAgo(item.ts)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
