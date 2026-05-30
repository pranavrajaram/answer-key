'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface EventConfirmButtonProps {
  eventId: string
  myVote: number | null // 1 confirmed, -1 disputed, null no vote
}

export default function EventConfirmButton({ eventId, myVote }: EventConfirmButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function vote(v: 1 | -1) {
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.rpc('confirm_event', {
      p_event_id: eventId,
      p_vote: v,
    })
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <button
          onClick={() => vote(1)}
          disabled={loading}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
            myVote === 1
              ? 'bg-teal-600 text-white'
              : 'border border-stone-200 text-stone-600 hover:border-teal-400 hover:text-teal-700 dark:border-stone-600/70 dark:text-stone-300'
          }`}
        >
          Confirm
        </button>
        <button
          onClick={() => vote(-1)}
          disabled={loading}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
            myVote === -1
              ? 'bg-red-500 text-white'
              : 'border border-stone-200 text-stone-600 hover:border-red-400 hover:text-red-600 dark:border-stone-600/70 dark:text-stone-300'
          }`}
        >
          Dispute
        </button>
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
