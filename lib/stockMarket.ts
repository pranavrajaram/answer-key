// Friend Stock Market — linear bonding curve AMM.
//
// A stock's price rises as shares are minted (bought) and falls as they are
// burned (sold). With shares outstanding `s`, base price `base`, and slope `k`:
//
//   spot(s)            = base + k·s
//   cost to buy n      = ∫[s→s+n] (base + k·x) dx = base·n + k·n·(2s + n)/2
//   proceeds to sell n = ∫[s−n→s] (base + k·x) dx = base·n + k·n·(2s − n)/2
//
// IMPORTANT: these formulas are duplicated in supabase/stocks.sql (buy_stock /
// sell_stock). Keep the two in sync — the SQL is the source of truth for money
// movement; this module exists so the client can preview costs without a round
// trip (mirrors how lib/lmsr.ts powers BetPanel's live odds).

export const TRADE_FEE_BPS = 100 // 1% fee, added to treasury

export function spotPrice(base: number, slope: number, shares: number): number {
  return base + slope * shares
}

// Raw cost (pre-fee) to buy `n` shares when `s` are outstanding.
export function buyCost(base: number, slope: number, s: number, n: number): number {
  return base * n + (slope * n * (2 * s + n)) / 2
}

// Raw proceeds (pre-fee) to sell `n` shares when `s` are outstanding.
export function sellProceeds(base: number, slope: number, s: number, n: number): number {
  return base * n + (slope * n * (2 * s - n)) / 2
}

// Fee taken on a trade's notional value. Charged on top of cost when buying,
// deducted from proceeds when selling.
export function tradeFee(amount: number, bps: number = TRADE_FEE_BPS): number {
  return Math.round((amount * bps) / 10000)
}

// What a buyer pays in total (rounded), and the fee portion.
export function buyTotal(
  base: number,
  slope: number,
  s: number,
  n: number,
  bps: number = TRADE_FEE_BPS
): { cost: number; fee: number; total: number } {
  const raw = buyCost(base, slope, s, n)
  const cost = Math.round(raw)
  const fee = tradeFee(raw, bps)
  return { cost, fee, total: cost + fee }
}

// What a seller nets (rounded) after fee, and the fee portion.
export function sellTotal(
  base: number,
  slope: number,
  s: number,
  n: number,
  bps: number = TRADE_FEE_BPS
): { proceeds: number; fee: number; net: number } {
  const raw = Math.max(0, sellProceeds(base, slope, s, n))
  const proceeds = Math.round(raw)
  const fee = tradeFee(raw, bps)
  return { proceeds, fee, net: Math.max(0, proceeds - fee) }
}

// Mark-to-market value of a set of holdings at current spot prices.
export function portfolioValue(
  holdings: { stockId: string; shares: number }[],
  spotByStock: Record<string, number>
): number {
  return holdings.reduce(
    (sum, h) => sum + h.shares * (spotByStock[h.stockId] ?? 0),
    0
  )
}

export function formatPrice(pts: number): string {
  return `${pts.toFixed(1)} pts`
}

export function pctChange(from: number, to: number): string {
  if (from === 0) return '—'
  const pct = ((to - from) / from) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

// Derive a 4-char uppercase ticker from a username. Caller is responsible for
// de-duplication (the DB has a unique constraint on stocks.ticker).
export function tickerFromUsername(username: string): string {
  const clean = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (clean.length <= 4) return clean.padEnd(1, 'X')
  // Prefer consonant-heavy abbreviation: keep first char + next 3 consonants.
  const first = clean[0]
  const rest = clean.slice(1).replace(/[AEIOU]/g, '')
  return (first + rest).slice(0, 4) || clean.slice(0, 4)
}
