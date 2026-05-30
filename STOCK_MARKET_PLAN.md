# Friend Stock Market — Implementation Plan

A "stock market for your friends" built on top of **answer-key**. Each person in the
friend group is a tradeable stock. You buy/sell shares of people based on what happens
in their life. Two forces move prices:

1. **Trading** — buying pushes a price up, selling pushes it down (automated market maker).
2. **Events** — real-life events (got a job, got arrested, went viral) apply price shocks
   and/or pay dividends to shareholders.

This reuses answer-key's currency (`points_balance`), its RPC/RLS/ledger patterns, and its
UI conventions. It ships as (a) a new section of the existing web app and (b) a native
Swift iMessage extension so the whole thing lives in the group chat.

> **Build rule (from AGENTS.md):** this is a modified Next.js 16. Before writing any code,
> read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

---

## 1. Core design

### 1.1 What is a "stock"?
- Every `profile` automatically gets exactly one `stock` (the way a profile is auto-created
  on first login today). One person = one ticker.
- Ticker derived from username, e.g. `username "pranav" → $PRNV` (4-char uppercase slug,
  de-duplicated).
- Stocks are **long-only** in v1. Shorting is a stretch goal (§9).

### 1.2 Pricing — a linear bonding curve AMM
LMSR is great for discrete-outcome prediction markets but wrong for a single continuous
asset. We use a **linear bonding curve**, which is self-liquidating (no counterparty
needed), gives instant buy/sell, and mirrors the integral-cost style already in
[`lib/lmsr.ts`](lib/lmsr.ts) / `lmsr_cost`.

Let `s` = shares outstanding, `base` = base price (event-adjustable), `k` = slope.

```
spot(s)            = base + k·s
cost to buy n      = ∫[s→s+n] (base + k·x) dx = base·n + k·n·(2s + n)/2
proceeds to sell n = ∫[s−n→s] (base + k·x) dx = base·n + k·n·(2s − n)/2
```

- Buying raises the price (you climb the curve); selling lowers it. Slippage discourages
  wash-trading / self-pumping — you can only get back less than you paid if you dump.
- Pick defaults so prices feel like "stock prices": `base = 10`, `k = 0.5`. First share
  ≈ 10 pts; price rises ~0.5 pts per share minted.
- **The AMM is closed**: total points paid in along the curve always ≥ total payable out.
  No money printer via trading.

### 1.3 Events move the curve
Two event flavors:

- **Price shock** — multiplies `base` by `m`. `base' = base · m`. This instantly revalues
  *every* holder's position (the whole curve shifts). Example: "Got a job" → `m = 1.15`
  (+15%); "Got arrested" → `m = 0.7` (−30%).
- **Dividend** — pays `d` points per share to current holders. Example: "Won an award →
  3 pts/share dividend."

A **preset event catalog** keeps magnitudes consistent and fun, e.g.:

| Event              | Effect            |
|--------------------|-------------------|
| New job            | base ×1.15        |
| Promotion / raise  | base ×1.10        |
| Went viral         | base ×1.20        |
| Graduated          | base ×1.08 + div 2|
| Got into a relationship | base ×1.05   |
| Breakup            | base ×0.92        |
| Got arrested       | base ×0.70        |
| Failed a class     | base ×0.90        |
| Custom             | proposer sets %   |

### 1.4 Trust model for events (friend-group sized)
Anyone can **propose** an event tagged to a person. To prevent abuse:
- An event is `pending` until it gets **N confirmations** (default 2, configurable) from
  *other* users, OR is applied by a designated **admin** (a flag on `profiles`).
- The subject of the stock can be allowed to confirm/dispute their own events.
- Every applied event writes to the `transactions` ledger pattern and a `stock_events`
  audit row. Rate-limit proposals per user per stock per day.

### 1.5 Economy integration
- Same `points_balance`. Buying spends points, selling returns points.
- **Net worth** (new headline number) = cash + Σ(shares × spot price) + open
  prediction-market positions. Leaderboard switches from raw `points_balance` to net worth.
- **Dividends are a points sink/source** — fund them from a per-stock *treasury* built up
  from a small **trade fee** (e.g. 1%) so the economy doesn't inflate. Fee → treasury;
  dividends paid from treasury (capped at treasury balance).
- **Consent**: stocks are real people. Add an opt-out flag (`stocks.tradable`) and a content
  guideline note. Sensitive events ("arrested") should be a product decision for your group.

---

## 2. Data model (Supabase)

New file `supabase/stocks.sql`, run after `schema.sql` + `addons.sql`. Mirrors existing
RLS + `security definer` RPC conventions.

```sql
create table public.stocks (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null unique references public.profiles(id) on delete cascade,
  ticker            text not null unique,
  base_price        float8 not null default 10,
  slope             float8 not null default 0.5,
  shares_outstanding integer not null default 0,
  treasury          integer not null default 0,
  tradable          boolean not null default true,
  created_at        timestamptz not null default now()
);

create table public.stock_trades (
  id         uuid primary key default gen_random_uuid(),
  stock_id   uuid not null references public.stocks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  side       text not null check (side in ('buy','sell')),
  shares     integer not null check (shares > 0),
  cost       integer not null,          -- points in (buy) / out (sell), incl fee
  fee        integer not null default 0,
  spot_after float8 not null,           -- price after trade (for charting)
  created_at timestamptz not null default now()
);

create table public.stock_holdings (         -- cached net position
  stock_id  uuid not null references public.stocks(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  shares    integer not null default 0,
  primary key (stock_id, user_id)
);

create table public.stock_events (
  id            uuid primary key default gen_random_uuid(),
  stock_id      uuid not null references public.stocks(id) on delete cascade,
  proposed_by   uuid not null references public.profiles(id),
  type          text not null,           -- catalog key or 'custom'
  label         text not null,
  multiplier    float8 not null default 1,
  dividend_per_share integer not null default 0,
  status        text not null default 'pending' check (status in ('pending','applied','rejected')),
  applied_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table public.stock_event_confirmations (
  event_id  uuid not null references public.stock_events(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  vote      smallint not null default 1,  -- +1 confirm, -1 dispute
  primary key (event_id, user_id)
);
```

- **Price history** for charts: derive from `stock_trades.spot_after` + `stock_events`
  timeline, or add a lightweight `stock_price_snapshots` table written by a cron Edge
  Function for evenly-spaced candles. Start by deriving; add snapshots if charts look sparse.
- RLS: read-all (like `markets`/`bets`), writes only via RPCs. Add `profiles.is_admin boolean`.

### RPCs (all `security definer`, `grant execute … to authenticated`)
- `buy_stock(p_stock_id, p_shares)` → validates balance, computes cost via curve, deducts
  points, adds fee to treasury, upserts holding, bumps `shares_outstanding`, logs trade +
  `transactions` row. (Mirror `place_bet`.)
- `sell_stock(p_stock_id, p_shares)` → validates net holding, computes proceeds, credits
  points, decrements outstanding, logs. (Mirror `sell_position`.)
- `propose_event(p_stock_id, p_type, p_label, p_multiplier, p_dividend)` → inserts `pending`.
- `confirm_event(p_event_id, p_vote)` → upserts confirmation; if confirmations ≥ threshold
  (or caller is admin) → **apply**: set `base_price *= multiplier`, pay dividends from
  treasury to holders pro-rata, mark `applied`, write ledger rows. Atomic.
- `auto_create_stock()` → trigger or extend the existing first-login profile bootstrap so a
  stock + ticker is created with the profile.
- `ensure_stocks()` backfill for existing profiles.

---

## 3. Shared pricing library

New `lib/stockMarket.ts`, styled exactly like [`lib/lmsr.ts`](lib/lmsr.ts) so client
components can render **live previews** (the way `BetPanel` previews LMSR odds with no
network call):

```ts
export function spotPrice(base: number, slope: number, shares: number): number
export function buyCost(base: number, slope: number, s: number, n: number): number
export function sellProceeds(base: number, slope: number, s: number, n: number): number
export function applyFee(amount: number, bps: number): { net: number; fee: number }
export function portfolioValue(holdings, stocks): number   // mark-to-market
export function formatPrice(pts: number): string           // "12.4 pts"
export function pctChange(from: number, to: number): string
```

Keep the exact same math in the SQL RPC and TS lib (single source of truth in comments) so
client previews match server execution.

---

## 4. Web app (Next.js)

Mirror the `app/markets/*` structure and reuse `ak-*` styling + dark-mode classes.

### Routes
- `app/stocks/page.tsx` — market index. Grid of `StockCard`s: ticker, name, spot price,
  24h % change, sparkline, your share count. Sort/filter (top movers, your holdings).
- `app/stocks/[id]/page.tsx` — stock detail (server component, `revalidate = 0` like
  `app/page.tsx`):
  - Price chart (movements from trades + event markers).
  - `TradePanel` (client) — buy/sell with slider + **live cost/proceeds preview** using
    `lib/stockMarket.ts`, mirroring [`components/BetPanel.tsx`](components/BetPanel.tsx).
  - Holders list (top shareholders) — reuse leaderboard styling.
  - Event feed + "Propose event" form with the preset catalog.
- `app/stocks/[id]/events/new` — propose event (or inline modal).

### Components (new, matching existing patterns)
- `StockCard.tsx` (← `MarketCard.tsx`)
- `TradePanel.tsx` (← `BetPanel.tsx` + `SellPanel.tsx`)
- `StockChart.tsx` (← `StatsGraph.tsx`)
- `EventFeed.tsx` / `EventProposeForm.tsx` / `EventConfirmButton.tsx`
- `PortfolioPanel.tsx` — extend `LeaderboardWithPortfolio.tsx` to include stock holdings.

### Navigation & integration
- Add **"Stocks"** to [`components/TabNav.tsx`](components/TabNav.tsx).
- [`components/Navbar.tsx`](components/Navbar.tsx): show **net worth** alongside points.
- `app/page.tsx` home: add a "Your portfolio" + "Top movers" section.
- `app/stats/page.tsx`: add net-worth-over-time and best/worst trades.

### Realtime (the "ticker" feel)
Subscribe to Supabase Realtime on `stocks` + `stock_trades` so prices tick live on the
index and detail pages without manual `router.refresh()`. Add a thin
`components/StockRealtime.tsx` wrapper.

---

## 5. Notifications

Extend the existing Edge Function pattern (`supabase/functions/notify-new-market`) with:
- `notify-stock-event` — on event applied, email/notify the group ("🚨 $PRNV +15%: New job").
- Optional digest: daily "market open/close" recap of top movers via Resend.
- Trigger via Supabase DB webhooks on `stock_events` (status→applied) like the market trigger.

---

## 6. iMessage app — native Swift extension

A full native **Messages app extension** (`MSMessagesAppViewController`) plus a thin
**companion iOS app** (needed for auth + App Group sharing). Separate Xcode project; talks
to Supabase over HTTPS.

### 6.1 Auth (the hard part)
Messages extensions are sandboxed and magic-link redirects are awkward inside them.
Recommended approach:
1. **Companion app** does a one-time login. Two good options:
   - Reuse magic-link (open Safari → `answerkey.../auth/callback` → deep link back), **or**
   - Add a **pairing code** flow on the web app: signed-in web user generates a 6-digit
     code; companion app exchanges it for a Supabase session via a new
     `redeem_pairing_code` RPC/Edge Function. Cleaner on iOS — **recommended**.
2. Store the Supabase **session (access + refresh tokens)** in a **shared Keychain via an
   App Group** (`group.com.yourname.answerkey`). The Messages extension reads tokens from
   the App Group, refreshes as needed. No login UI inside the extension.

### 6.2 Networking
Use **[supabase-swift](https://github.com/supabase/supabase-swift)** (official SDK) — gives
you Auth (token refresh), PostgREST queries, and RPC calls (`buy_stock`, etc.) with the
user's JWT, so **RLS applies identically to web**. No new backend needed.

### 6.3 Features in the extension
- **Browse & trade** — compact list of stocks with live prices; tap a stock → buy/sell with
  a stepper. Compact + expanded presentation styles (`requestPresentationStyle`).
- **Ticker cards in chat** — compose an `MSMessage` bubble showing a stock's price + a "Buy"
  button. Tapping it opens the extension on that stock for the recipient. Use a rendered
  `MSMessageTemplateLayout` (image + caption) so it looks rich even before tapping.
- **Event cards in chat** *(the killer feature)* — log a life event from the chat. It posts
  an event card others tap to **confirm**; once it hits the confirmation threshold the price
  moves. Events literally happen where they happen — the group chat.
- **Live updates** — update a sent `MSMessage` (same `session`) to reflect "price moved" /
  "event confirmed (2/2) → applied +15%".

### 6.4 Project structure
```
ios/
  AnswerKey.xcodeproj
  AnswerKey/                 # companion app (login + pairing, App Group write)
  AnswerKeyMessages/         # MSMessagesAppViewController extension
  Shared/                    # SupabaseClient, models, Keychain/App Group helpers
```
- Requires an **Apple Developer account ($99/yr)**. Distribute to the friend group via
  **TestFlight** (easy) or ad-hoc.
- Models mirror `lib/types.ts`; pricing mirrors `lib/stockMarket.ts` (port the curve math to
  Swift, or just call RPCs and let the server compute — recommended to avoid drift).

---

## 7. Anti-abuse & economy safety
- **Slippage + 1% trade fee** discourage wash trading / self-pumping.
- **Event confirmation threshold + rate limits + admin override + audit log**.
- **Dividends funded from treasury only** (no uncapped point printing).
- Consider banning trading your *own* stock, or allow it but exclude from "top mover" glory.
- Backfill/seed: extend `supabase/seed.sql` with sample stocks/trades for local dev.

---

## 8. Phased delivery

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| **0** | `supabase/stocks.sql` schema + RLS, `lib/stockMarket.ts`, `buy_stock`/`sell_stock` RPCs, auto-create stock on signup + backfill | Trading works via RPC |
| **1** | Web trading UI: `/stocks`, `/stocks/[id]`, `StockCard`, `TradePanel`, chart | You can buy/sell on the site |
| **2** | Events: catalog, `propose_event`/`confirm_event`/apply, dividends, event feed UI | Prices move from life events |
| **3** | Net-worth leaderboard, portfolio on home/stats, Realtime ticker | Full economy integration |
| **4** | `notify-stock-event` Edge Function + DB webhook, digests | Group gets notified |
| **5** | iMessage: pairing-code auth + companion app, App Group keychain, browse/trade, ticker cards, event cards | Lives in the group chat |
| **6** | Polish, anti-abuse tuning, seed data, consent/opt-out | Ship |

Phases 0–4 are pure web/Supabase and can ship independently of the iOS work. Phase 5
(iMessage) only depends on the RPCs from Phases 0–2 existing.

## 9. Stretch goals
- **Shorting** (borrow/short shares with margin) — adds real "sell when arrested" upside.
- **Limit orders / price alerts**.
- **Indices** (e.g. "the friend group ETF").
- **Seasons** with resets and a hall of fame, tied to existing leaderboard.
- **Auto-events** from integrations (LinkedIn job change, etc.) — fun but privacy-sensitive.
</content>
</invoke>
