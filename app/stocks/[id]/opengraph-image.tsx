import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { spotPrice } from '@/lib/stockMarket'

export const alt = 'Stock price on Answer Key'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Fetched fresh per request (prices move). iMessage/Open Graph crawlers send no
// cookies, so use a plain anon client — RLS allows anyone to read these tables.
export const revalidate = 0

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [{ data: stock }, { data: trades }] = await Promise.all([
    supabase
      .from('stocks')
      .select('ticker, base_price, slope, shares_outstanding, profiles!stocks_profile_id_fkey(username)')
      .eq('id', id)
      .single(),
    supabase
      .from('stock_trades')
      .select('spot_after, created_at')
      .eq('stock_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const ticker = stock?.ticker ?? '???'
  // deno/edge-safe access to embedded profile
  const username =
    (stock?.profiles as { username?: string } | null)?.username ?? 'unknown'
  const spot = stock ? spotPrice(stock.base_price, stock.slope, stock.shares_outstanding) : 0

  // 24h change from the most recent trade at least 24h old.
  const cutoff = new Date().getTime() - 24 * 60 * 60 * 1000
  let ref: number | null = null
  for (const t of trades ?? []) {
    if (new Date(t.created_at).getTime() <= cutoff) {
      ref = t.spot_after
      break
    }
  }
  const changePct = ref !== null && ref > 0 ? ((spot - ref) / ref) * 100 : null
  const up = changePct !== null && changePct > 0
  const down = changePct !== null && changePct < 0
  const changeColor = up ? '#14b8a6' : down ? '#f87171' : '#a8a29e'
  const changeText =
    changePct === null ? '' : `${up ? '▲' : down ? '▼' : ''} ${Math.abs(changePct).toFixed(1)}% today`

  // Sparkline from trade history (oldest → newest) + current spot.
  const points = [...(trades ?? [])].reverse().map(t => t.spot_after)
  points.push(spot)
  let spark = ''
  if (points.length >= 2) {
    const w = 1040
    const h = 160
    const min = Math.min(...points)
    const max = Math.max(...points)
    const range = max - min || 1
    spark = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * w
        const y = h - ((p - min) / range) * h
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#1c1917',
          padding: '64px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 88, fontWeight: 800, color: '#fafaf9', letterSpacing: '-2px' }}>
              {`$${ticker}`}
            </div>
            <div style={{ fontSize: 34, color: '#a8a29e', marginTop: 8 }}>{username}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 96, fontWeight: 800, color: '#fafaf9' }}>{spot.toFixed(1)}</div>
            <div style={{ fontSize: 32, color: changeColor, marginTop: 4 }}>{changeText || 'pts'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', marginTop: 20 }}>
          {spark ? (
            <svg width="1040" height="160" viewBox="0 0 1040 160">
              <path d={spark} fill="none" stroke={up ? '#14b8a6' : down ? '#f87171' : '#5eead4'} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', color: '#57534e', fontSize: 28 }}>
              No trades yet — be the first
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, color: '#5eead4', fontWeight: 700 }}>
            Answer Key · Stock Market
          </div>
          <div style={{ fontSize: 28, color: '#a8a29e' }}>Tap to trade →</div>
        </div>
      </div>
    ),
    size
  )
}
