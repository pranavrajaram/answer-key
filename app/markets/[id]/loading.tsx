import RouteLoadingSkeleton from '@/components/RouteLoadingSkeleton'

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Market"
      subtitle="Loading market details"
      showTabs={false}
      variant="detail"
    />
  )
}
