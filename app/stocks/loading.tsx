import RouteLoadingSkeleton from '@/components/RouteLoadingSkeleton'

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Stocks"
      subtitle="Loading the market"
      activeTab="stocks"
    />
  )
}
