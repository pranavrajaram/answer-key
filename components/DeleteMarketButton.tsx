'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DeleteMarketButtonProps {
  marketId: string
}

export default function DeleteMarketButton({ marketId }: DeleteMarketButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.rpc('delete_market', {
      p_market_id: marketId,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      setConfirming(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="space-y-3 rounded-2xl border border-red-200/80 bg-white/80 p-4 shadow-sm dark:border-red-500/30 dark:bg-stone-900/50 dark:shadow-none">
        <p className="text-sm text-stone-700 dark:text-stone-300">
          All bettors will be refunded. This can&apos;t be undone.
        </p>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="ak-button-secondary flex-1 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60 dark:bg-red-500 dark:hover:bg-red-600"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full rounded-xl border border-stone-200 bg-white/70 py-2.5 text-sm font-semibold text-red-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-stone-600 dark:bg-stone-900/50 dark:text-red-400 dark:hover:border-red-500/40 dark:hover:bg-red-950/25 dark:hover:text-red-300"
    >
      Delete market
    </button>
  )
}
