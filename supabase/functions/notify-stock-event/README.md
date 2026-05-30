# notify-stock-event

Emails the whole friend group when a stock life-event is **applied** (price
shock and/or dividend). Mirrors `notify-new-market`.

It fires only on the transition into `status = 'applied'`, so proposing an
event (status `pending`) and confirmations don't spam — only the moment a price
actually moves.

## Deploy

Requires the Supabase CLI and the project's access token (dashboard owner).

```bash
# one-time: link the project (ref from the dashboard URL)
supabase link --project-ref mqvjeymrwgyeydkjyhnf

# the function reuses the same secrets as notify-new-market.
# If not already set on the project:
supabase secrets set RESEND_API_KEY=...        # same key notify-new-market uses
supabase secrets set APP_URL=https://answerkey.pranavrajaram.com
supabase secrets set FROM_EMAIL=noreply@pranavrajaram.com

supabase functions deploy notify-stock-event
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## Wire the webhook

Dashboard → **Database → Webhooks → Create a new hook**:

- **Table**: `public.stock_events`
- **Events**: `Insert` **and** `Update`
- **Type**: Supabase Edge Function → `notify-stock-event`
- **Method**: `POST`

The function reads `payload.record` (new row) and `payload.old_record` (previous
row, present on updates) and only sends when `record.status === 'applied'` and
the old status wasn't already `applied`.

> Why both Insert and Update? An event is created `pending` (Insert) and later
> flipped to `applied` (Update) by `confirm_event`. If an admin's single
> confirmation ever applied it within the same flow, the apply still arrives as
> an Update to `stock_events`, so Update is the one that matters — Insert is
> included only for safety/forward-compat.

## Test locally (optional)

```bash
supabase functions serve notify-stock-event
curl -X POST http://localhost:54321/functions/v1/notify-stock-event \
  -H 'Content-Type: application/json' \
  -d '{"type":"UPDATE","record":{"id":"...","stock_id":"<a real stock id>","label":"New job","multiplier":1.15,"dividend_per_share":0,"status":"applied"},"old_record":{"status":"pending"}}'
```
