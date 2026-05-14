import RouteLoadingSkeleton from '@/components/RouteLoadingSkeleton'

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Resolve market"
      subtitle="Loading resolution details"
      showTabs={false}
      variant="detail"
    />
  )
}
