import RouteLoadingSkeleton from '@/components/RouteLoadingSkeleton'

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Stats"
      subtitle="Crunching all-time performance"
      activeTab="stats"
      variant="stats"
    />
  )
}
