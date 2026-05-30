'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface StockRealtimeProps {
  // Optional: only react to changes for this stock (detail page). Omit to
  // listen for any stock change (index page).
  stockId?: string
}

// Subscribes to live stock changes and refreshes the server components so
// prices/holdings/events update without a manual reload. Debounced so a burst
// of changes triggers a single refresh.
export default function StockRealtime({ stockId }: StockRealtimeProps) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => router.refresh(), 350)
    }

    const filter = stockId ? `stock_id=eq.${stockId}` : undefined

    const channel = supabase
      .channel(`stocks-realtime-${stockId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_trades', ...(filter ? { filter } : {}) },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_events', ...(filter ? { filter } : {}) },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        // stocks PK is `id`, not `stock_id`
        { event: 'UPDATE', schema: 'public', table: 'stocks', ...(stockId ? { filter: `id=eq.${stockId}` } : {}) },
        scheduleRefresh
      )
      .subscribe()

    return () => {
      if (timer.current) clearTimeout(timer.current)
      supabase.removeChannel(channel)
    }
  }, [router, stockId])

  return null
}
