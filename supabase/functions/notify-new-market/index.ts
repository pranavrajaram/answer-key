import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://answerkey.pranavrajaram.com'
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@pranavrajaram.com'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const market = payload.record

    if (!market?.id || !market?.question) {
      return new Response('Missing market data', { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get creator's username
    const { data: creator } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', market.creator_id)
      .single()

    // Get all user emails from auth
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const emails = users.map(u => u.email).filter(Boolean) as string[]

    if (emails.length === 0) {
      return new Response('No users to notify', { status: 200 })
    }

    const marketUrl = `${APP_URL}/markets/${market.id}`
    const creatorName = creator?.username ?? 'Someone'
    const closesAt = new Date(market.closes_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    })

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
        <p style="font-size: 13px; color: #888; margin-bottom: 24px;">Answer Key</p>
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 8px;">${market.question}</h2>
        <p style="font-size: 14px; color: #555; margin: 0 0 4px;">
          Created by <strong>${creatorName}</strong>
        </p>
        <p style="font-size: 14px; color: #555; margin: 0 0 24px;">
          Closes ${closesAt}
        </p>
        <p style="font-size: 14px; color: #555; margin: 0 0 24px;">
          Options: ${market.options.join(' · ')}
        </p>
        <a href="${marketUrl}" style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Place a bet →
        </a>
        <p style="font-size: 12px; color: #aaa; margin-top: 32px;">
          <a href="${APP_URL}" style="color: #aaa;">Answer Key</a>
        </p>
      </div>
    `

    // Send as BCC so recipients don't see each other's emails
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
        subject: `New market: ${market.question}`,
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
