import RouteLoadingSkeleton from '@/components/RouteLoadingSkeleton'

export default function Loading() {
  return (
    <RouteLoadingSkeleton
      title="Create a market"
      subtitle="Preparing the market form"
      showTabs={false}
      variant="form"
    />
  )
}
