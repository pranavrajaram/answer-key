import RouteLoadingSkeleton from '@/components/RouteLoadingSkeleton'

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Stock"
      subtitle="Loading stock details"
      showTabs={false}
      variant="detail"
    />
  )
}
