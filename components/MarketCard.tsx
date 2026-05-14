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
    <Link href={`/markets/${market.id}`} className="block">
      <div className="ak-card ak-card-hover p-5">
        <div className="flex items-start justify-between gap-2 mb-4">
          <h3 className="font-semibold leading-snug text-stone-900">{market.question}</h3>
          {isOpen ? (
            <Countdown closesAt={market.closes_at} />
          ) : market.resolved_option ? (
            <span className="ak-badge bg-teal-50 text-teal-700">
              Resolved: {market.resolved_option}
            </span>
          ) : (
            <span className="ak-badge bg-stone-100 text-stone-500">
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
