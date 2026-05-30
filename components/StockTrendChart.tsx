export interface TrendSeries {
  ticker: string
  points: { t: number; price: number }[] // chronological
}

const PALETTE = [
  '#0d9488', // teal
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#0ea5e9', // sky
  '#84cc16', // lime
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal-2
  '#a855f7', // purple
]

// Overlays each stock's price trend on a shared axis.
export default function StockTrendChart({ series }: { series: TrendSeries[] }) {
  const all = series.flatMap(s => s.points)
  const hasMovement = series.some(s => s.points.length >= 2)

  if (all.length === 0 || !hasMovement) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-stone-200/70 bg-stone-50/60 text-sm text-stone-400 dark:border-stone-700/60 dark:bg-stone-900/40 dark:text-stone-500">
        Trends appear here once people start trading
      </div>
    )
  }

  const w = 720
  const h = 200
  const padX = 10
  const padY = 12

  const tMin = Math.min(...all.map(p => p.t))
  const tMax = Math.max(...all.map(p => p.t))
  const pMin = Math.min(...all.map(p => p.price))
  const pMax = Math.max(...all.map(p => p.price))
  const tRange = tMax - tMin || 1
  const pRange = pMax - pMin || 1

  const x = (t: number) => padX + ((t - tMin) / tRange) * (w - 2 * padX)
  const y = (p: number) => padY + (1 - (p - pMin) / pRange) * (h - 2 * padY)

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-stone-200/70 bg-stone-50/60 p-2 dark:border-stone-700/60 dark:bg-stone-900/40">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full" preserveAspectRatio="none">
          {series.map((s, i) => {
            if (s.points.length === 0) return null
            const color = PALETTE[i % PALETTE.length]
            const d = s.points
              .map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`)
              .join(' ')
            const last = s.points[s.points.length - 1]
            return (
              <g key={s.ticker}>
                <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(last.t)} cy={y(last.price)} r={2.5} fill={color} />
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s, i) => (
          <span key={s.ticker} className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
            />
            <span className="font-mono font-medium text-stone-700 dark:text-stone-300">${s.ticker}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
