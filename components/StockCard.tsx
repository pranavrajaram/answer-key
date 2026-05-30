import Link from 'next/link'

interface StockCardProps {
  id: string
  ticker: string
  username: string
  price: number
  dayChangePct: number | null
  yourShares: number
}

export default function StockCard({
  id,
  ticker,
  username,
  price,
  dayChangePct,
  yourShares,
}: StockCardProps) {
  const up = dayChangePct !== null && dayChangePct > 0
  const down = dayChangePct !== null && dayChangePct < 0

  return (
    <Link href={`/stocks/${id}`} prefetch className="block">
      <div className="ak-card ak-card-hover p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold tracking-wide text-stone-900 dark:text-stone-100">
                ${ticker}
              </span>
              {yourShares > 0 && (
                <span className="ak-badge bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
                  {yourShares} held
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-stone-400">{username}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              {price.toFixed(1)}
              <span className="ml-1 text-xs font-normal text-stone-400 dark:text-stone-500">pts</span>
            </p>
            <p
              className={`text-xs font-medium tabular-nums ${
                up
                  ? 'text-teal-600 dark:text-teal-400'
                  : down
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-stone-400 dark:text-stone-500'
              }`}
            >
              {dayChangePct === null
                ? '—'
                : `${up ? '▲' : down ? '▼' : ''} ${Math.abs(dayChangePct).toFixed(1)}%`}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
