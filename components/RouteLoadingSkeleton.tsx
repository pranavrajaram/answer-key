type ActiveTab = 'markets' | 'activity' | 'stats'

interface RouteLoadingSkeletonProps {
  title?: string
  subtitle?: string
  activeTab?: ActiveTab
  showTabs?: boolean
  variant?: 'list' | 'form' | 'detail' | 'stats'
}

const tabs: { label: string; key: ActiveTab }[] = [
  { label: 'Markets', key: 'markets' },
  { label: 'Activity', key: 'activity' },
  { label: 'Stats', key: 'stats' },
]

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-stone-200/80 dark:bg-stone-600/70 ${className}`} />
}

function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-[var(--ak-bg)] dark:border-stone-700/60">
      <div className="ak-container flex h-16 items-center justify-between">
        <span className="font-semibold tracking-tight text-stone-950 dark:text-stone-100">Answer Key</span>
        <div className="flex items-center gap-3">
          <SkeletonLine className="h-8 w-20" />
          <SkeletonLine className="hidden h-4 w-20 sm:block" />
        </div>
      </div>
    </header>
  )
}

function TabSkeleton({ activeTab = 'markets' }: { activeTab?: ActiveTab }) {
  return (
    <nav className="mb-6 grid w-full max-w-sm grid-cols-3 rounded-2xl border border-stone-200/80 bg-white/65 p-1 dark:border-stone-600/35 dark:bg-stone-800/35 sm:inline-grid">
      {tabs.map(tab => (
        <div
          key={tab.key}
          className={`rounded-xl px-3 py-2 text-center text-sm font-semibold leading-none ${
            activeTab === tab.key
              ? 'bg-stone-900 text-white shadow-sm dark:bg-teal-500/18 dark:text-teal-50 dark:shadow-none dark:ring-1 dark:ring-inset dark:ring-teal-400/35'
              : 'text-stone-400 dark:text-stone-500'
          }`}
        >
          {tab.label}
        </div>
      ))}
    </nav>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(item => (
        <div key={item} className="ak-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <SkeletonLine className="h-4 w-5/6" />
              <SkeletonLine className="h-3 w-2/5" />
            </div>
            <SkeletonLine className="h-7 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

function FormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="ak-card space-y-5 p-4 sm:p-6">
        <div className="space-y-2">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-10 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <SkeletonLine className="h-4 w-40" />
          <SkeletonLine className="h-10 w-full rounded-xl" />
          <SkeletonLine className="h-10 w-full rounded-xl" />
        </div>
        <SkeletonLine className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
      <div className="space-y-5 xl:col-span-2">
        <div className="ak-card space-y-5 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <SkeletonLine className="h-6 w-4/5" />
            <SkeletonLine className="h-7 w-24" />
          </div>
          <SkeletonLine className="h-24 w-full rounded-2xl" />
          <SkeletonLine className="h-4 w-2/3" />
        </div>
        <div className="ak-card space-y-3 p-4 sm:p-6">
          <SkeletonLine className="h-4 w-28" />
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-5/6" />
        </div>
      </div>
      <div className="space-y-4">
        <SkeletonLine className="h-36 w-full rounded-2xl" />
        <SkeletonLine className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="ak-card p-4 sm:p-5">
        <SkeletonLine className="mb-4 h-4 w-40" />
        <SkeletonLine className="h-[260px] w-full rounded-2xl" />
      </div>
      <div className="ak-card space-y-3 p-4">
        {[0, 1, 2, 3].map(row => (
          <div key={row} className="grid grid-cols-4 gap-4">
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="hidden h-4 w-full sm:block" />
            <SkeletonLine className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RouteLoadingSkeleton({
  title = 'Loading',
  subtitle = 'Fetching the latest market data',
  activeTab = 'markets',
  showTabs = true,
  variant = 'list',
}: RouteLoadingSkeletonProps) {
  return (
    <div className="ak-page">
      <HeaderSkeleton />
      <main className="ak-container py-6 sm:py-8">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">{title}</h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{subtitle}</p>
          </div>
        </div>
        {showTabs && <TabSkeleton activeTab={activeTab} />}
        {variant === 'list' && <ListSkeleton />}
        {variant === 'form' && <FormSkeleton />}
        {variant === 'detail' && <DetailSkeleton />}
        {variant === 'stats' && <StatsSkeleton />}
      </main>
    </div>
  )
}
