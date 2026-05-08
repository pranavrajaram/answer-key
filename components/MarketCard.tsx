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
      <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all">
        <div className="flex items-start justify-between gap-2 mb-4">
          <h3 className="font-medium text-gray-900 leading-snug">{market.question}</h3>
          {isOpen ? (
            <Countdown closesAt={market.closes_at} />
          ) : market.resolved_option ? (
            <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full whitespace-nowrap">
              Resolved: {market.resolved_option}
            </span>
          ) : (
            <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
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
