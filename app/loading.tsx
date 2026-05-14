import RouteLoadingSkeleton from '@/components/RouteLoadingSkeleton'

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Markets"
      subtitle="Loading the latest open markets"
      activeTab="markets"
    />
  )
}
