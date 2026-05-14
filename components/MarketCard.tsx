import Link from 'next/link'
import { Market } from '@/lib/types'
import ProbabilityBar from './ProbabilityBar'
import Countdown from './Countdown'

interface MarketCardProps {
  market: Market
}

export default function MarketCard({ market }: MarketCardProps) {
  const isOpen = !market.resolved_option && new Date(market.closes_at) > new Date()

  return (
    <Link href={`/markets/${market.id}`} prefetch className="block">
      <div className="ak-card ak-card-hover p-4 sm:p-5">
        <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
          <h3 className="min-w-0 text-base font-semibold leading-snug text-stone-900 dark:text-stone-100">
            {market.question}
          </h3>
          {isOpen ? (
            <Countdown closesAt={market.closes_at} />
          ) : market.resolved_option ? (
            <span className="ak-badge bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
              Resolved: {market.resolved_option}
            </span>
          ) : (
            <span className="ak-badge bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
              Closed
            </span>
          )}
        </div>
        <ProbabilityBar
          options={market.options}
          qValues={market.q_values}
          b={market.b}
        />
      </div>
    </Link>
  )
}
