import { StockEventStatus } from '@/lib/types'
import {
  emojiForEvent,
  multiplierLabel,
  EVENT_CONFIRM_THRESHOLD,
} from '@/lib/stockEvents'
import EventConfirmButton from './EventConfirmButton'

export interface FeedEvent {
  id: string
  type: string
  label: string
  multiplier: number
  dividend_per_share: number
  status: StockEventStatus
  created_at: string
  applied_at: string | null
  proposerName: string
  confirmCount: number
  myVote: number | null
}

function effectColor(multiplier: number): string {
  if (multiplier > 1) return 'text-teal-600 dark:text-teal-400'
  if (multiplier < 1) return 'text-red-500 dark:text-red-400'
  return 'text-stone-600 dark:text-stone-300'
}

export default function EventFeed({ events }: { events: FeedEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="ak-card p-5">
        <h2 className="mb-2 font-semibold text-stone-900 dark:text-stone-100">Events</h2>
        <p className="text-sm text-stone-400 dark:text-stone-500">
          No events yet. Log a life event to move the price.
        </p>
      </div>
    )
  }

  return (
    <div className="ak-card p-5">
      <h2 className="mb-4 font-semibold text-stone-900 dark:text-stone-100">Events</h2>
      <div className="space-y-3">
        {events.map(e => {
          const isPending = e.status === 'pending'
          const isRejected = e.status === 'rejected'
          return (
            <div
              key={e.id}
              className={`rounded-xl border p-3 ${
                isPending
                  ? 'border-amber-200/80 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20'
                  : isRejected
                    ? 'border-stone-200/70 bg-stone-50/60 opacity-70 dark:border-stone-700/60 dark:bg-stone-900/40'
                    : 'border-stone-200/70 bg-stone-50/60 dark:border-stone-700/60 dark:bg-stone-900/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                    <span className="mr-1.5">{emojiForEvent(e.type)}</span>
                    {e.label}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                    by {e.proposerName}
                    {' · '}
                    <span className={effectColor(e.multiplier)}>
                      {multiplierLabel(e.multiplier)}
                      {e.dividend_per_share > 0 && ` · ${e.dividend_per_share} pts/share`}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {isPending ? (
                    <>
                      <p className="mb-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        {e.confirmCount}/{EVENT_CONFIRM_THRESHOLD} confirmed
                      </p>
                      <EventConfirmButton eventId={e.id} myVote={e.myVote} />
                    </>
                  ) : isRejected ? (
                    <span className="ak-badge bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                      Rejected
                    </span>
                  ) : (
                    <span className="ak-badge bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
                      Applied
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
