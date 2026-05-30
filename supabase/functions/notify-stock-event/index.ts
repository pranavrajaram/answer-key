import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://answerkey.pranavrajaram.com'
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@pranavrajaram.com'

interface StockEventRecord {
  id: string
  stock_id: string
  proposed_by: string
  type: string
  label: string
  multiplier: number
  dividend_per_share: number
  status: string
}

// Configure this as a Supabase DB webhook on public.stock_events for
// INSERT + UPDATE. We notify only when an event becomes "applied".
Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record as StockEventRecord | undefined
    const oldRecord = payload.old_record as StockEventRecord | undefined

    if (!record?.id) {
      return new Response('Missing event data', { status: 400 })
    }

    // Only fire on the transition into "applied".
    const becameApplied =
      record.status === 'applied' && (!oldRecord || oldRecord.status !== 'applied')
    if (!becameApplied) {
      return new Response('Not an apply transition; skipping', { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Stock ticker + subject username
    const { data: stock } = await supabase
      .from('stocks')
      .select('ticker, base_price, slope, shares_outstanding, profiles!stocks_profile_id_fkey(username)')
      .eq('id', record.stock_id)
      .single()

    const ticker = stock?.ticker ?? '???'
    // deno-lint-ignore no-explicit-any
    const subjectName = (stock?.profiles as any)?.username ?? 'someone'
    const spot =
      stock ? stock.base_price + stock.slope * stock.shares_outstanding : null

    // All user emails
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const emails = users.map(u => u.email).filter(Boolean) as string[]
    if (emails.length === 0) {
      return new Response('No users to notify', { status: 200 })
    }

    const pct = Math.round((record.multiplier - 1) * 100)
    const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
    const pctText = pct === 0 ? 'no price change' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`
    const arrow = dir === 'up' ? '📈' : dir === 'down' ? '📉' : '📊'
    const color = dir === 'up' ? '#0d9488' : dir === 'down' ? '#ef4444' : '#78716c'
    const divText = record.dividend_per_share > 0
      ? ` · ${record.dividend_per_share} pts/share dividend`
      : ''

    const stockUrl = `${APP_URL}/stocks/${record.stock_id}`
    const subject = `${arrow} $${ticker} ${pctText}: ${record.label}`

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1c1917;">
        <p style="font-size: 13px; color: #9ca3af; margin: 0 0 24px;">Answer Key · Stock Market</p>
        <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 6px;">
          <span style="font-family: monospace;">$${ticker}</span> ${arrow} ${pctText}
        </h2>
        <p style="font-size: 15px; color: #44403c; margin: 0 0 4px;">
          <strong>${subjectName}</strong>: ${record.label}
        </p>
        <p style="font-size: 14px; color: ${color}; font-weight: 600; margin: 0 0 4px;">
          ${pctText}${divText}
        </p>
        ${spot !== null ? `<p style="font-size: 14px; color: #78716c; margin: 0 0 24px;">New price: ${spot.toFixed(1)} pts</p>` : ''}
        <a href="${stockUrl}" style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">
          Trade $${ticker} →
        </a>
        <p style="font-size: 12px; color: #a8a29e; margin-top: 32px;">
          <a href="${APP_URL}/stocks" style="color: #a8a29e;">Answer Key</a>
        </p>
      </div>
    `

    const [firstEmail, ...rest] = emails
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Answer Key <${FROM_EMAIL}>`,
        to: firstEmail,
        bcc: rest.length > 0 ? rest : undefined,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response('Email send failed', { status: 500 })
    }

    return new Response('Notified ' + emails.length + ' users', { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response('Internal error', { status: 500 })
  }
})
