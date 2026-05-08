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
      <div className="bg-white border border-red-200 rounded-xl p-4 space-y-3">
        <p className="text-sm text-gray-700">
          All bettors will be refunded. This can't be undone.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="flex-1 text-sm bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 text-sm bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-60"
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
      className="w-full text-sm text-red-500 hover:text-red-700 hover:bg-red-50 border border-gray-200 hover:border-red-200 font-medium py-2.5 rounded-xl transition-all"
    >
      Delete market
    </button>
  )
}
