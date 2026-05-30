interface StockChartProps {
  // chronological price points (oldest → newest)
  points: number[]
}

// Minimal dependency-free sparkline-style price chart.
export default function StockChart({ points }: StockChartProps) {
  if (points.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-stone-200/70 bg-stone-50/60 text-sm text-stone-400 dark:border-stone-700/60 dark:bg-stone-900/40 dark:text-stone-500">
        Not enough trades to chart yet
      </div>
    )
  }

  const w = 600
  const h = 160
  const pad = 8
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - 2 * pad)
    const y = pad + (1 - (p - min) / range) * (h - 2 * pad)
    return [x, y] as const
  })

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`

  const up = points[points.length - 1] >= points[0]
  const stroke = up ? '#0d9488' : '#ef4444'
  const fill = up ? 'rgba(13,148,136,0.10)' : 'rgba(239,68,68,0.10)'

  return (
    <div className="rounded-2xl border border-stone-200/70 bg-stone-50/60 p-2 dark:border-stone-700/60 dark:bg-stone-900/40">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
        <path d={area} fill={fill} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  )
}
