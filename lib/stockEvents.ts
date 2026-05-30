// Preset catalog of life events. `multiplier` scales a stock's base price;
// `dividendPerShare` pays holders from the stock's treasury. These map onto the
// propose_event RPC args (type, label, multiplier, dividend).

export interface EventPreset {
  key: string
  label: string
  emoji: string
  multiplier: number
  dividendPerShare: number
  kind: 'up' | 'down' | 'neutral'
}

export const EVENT_PRESETS: EventPreset[] = [
  { key: 'new_job',      label: 'New job',          emoji: '🧑‍💼', multiplier: 1.15, dividendPerShare: 0, kind: 'up' },
  { key: 'promotion',    label: 'Promotion / raise', emoji: '📈',  multiplier: 1.10, dividendPerShare: 0, kind: 'up' },
  { key: 'viral',        label: 'Went viral',        emoji: '🚀',  multiplier: 1.20, dividendPerShare: 0, kind: 'up' },
  { key: 'award',        label: 'Won an award',      emoji: '🏆',  multiplier: 1.12, dividendPerShare: 3, kind: 'up' },
  { key: 'graduated',    label: 'Graduated',         emoji: '🎓',  multiplier: 1.08, dividendPerShare: 2, kind: 'up' },
  { key: 'relationship', label: 'New relationship',  emoji: '❤️',  multiplier: 1.05, dividendPerShare: 0, kind: 'up' },
  { key: 'sick',         label: 'Got sick',          emoji: '🤒',  multiplier: 0.95, dividendPerShare: 0, kind: 'down' },
  { key: 'failed',       label: 'Failed a class',    emoji: '📉',  multiplier: 0.90, dividendPerShare: 0, kind: 'down' },
  { key: 'breakup',      label: 'Breakup',           emoji: '💔',  multiplier: 0.92, dividendPerShare: 0, kind: 'down' },
  { key: 'arrested',     label: 'Got arrested',      emoji: '🚔',  multiplier: 0.70, dividendPerShare: 0, kind: 'down' },
  { key: 'custom',       label: 'Custom',            emoji: '✏️',  multiplier: 1.0,  dividendPerShare: 0, kind: 'neutral' },
]

export const EVENT_PRESET_BY_KEY: Record<string, EventPreset> = Object.fromEntries(
  EVENT_PRESETS.map(p => [p.key, p])
)

// Number of confirmations (incl. the proposer) needed to auto-apply an event.
export const EVENT_CONFIRM_THRESHOLD = 2

// Human-readable price effect, e.g. "+15%" or "−30%".
export function multiplierLabel(multiplier: number): string {
  const pct = Math.round((multiplier - 1) * 100)
  if (pct === 0) return 'no price change'
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`
}

export function emojiForEvent(type: string): string {
  return EVENT_PRESET_BY_KEY[type]?.emoji ?? '📰'
}
