'use client'

import { useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const CORE_ROUTES = ['/', '/activity', '/stats', '/markets/new']
const EMPTY_HREFS: string[] = []

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean
  }
}

type WindowWithIdle = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number
    cancelIdleCallback?: (handle: number) => void
  }

interface RoutePrefetcherProps {
  hrefs?: string[]
  maxRoutes?: number
}

function normalizeHref(href: string) {
  if (!href.startsWith('/')) return null
  if (href.length > 1 && href.endsWith('/')) return href.slice(0, -1)
  return href
}

export default function RoutePrefetcher({
  hrefs = EMPTY_HREFS,
  maxRoutes = 18,
}: RoutePrefetcherProps) {
  const router = useRouter()
  const pathname = usePathname()

  const targets = useMemo(() => {
    const current = pathname ? normalizeHref(pathname) : null
    const unique = new Set<string>()

    for (const href of [...CORE_ROUTES, ...hrefs]) {
      const normalized = normalizeHref(href)
      if (!normalized || normalized === current) continue
      unique.add(normalized)
    }

    return Array.from(unique).slice(0, maxRoutes)
  }, [hrefs, maxRoutes, pathname])

  useEffect(() => {
    if (targets.length === 0) return

    const connection = (navigator as NavigatorWithConnection).connection
    if (connection?.saveData) return

    const win = window as WindowWithIdle
    let cancelled = false
    let idleId: number | null = null
    let timerId: number | null = null

    // Stagger prefetches so mobile devices are not hit with all route work at once.
    function prefetchRoute(index: number) {
      if (cancelled || index >= targets.length || document.hidden) return

      router.prefetch(targets[index])

      if (index + 1 < targets.length) {
        timerId = window.setTimeout(() => prefetchRoute(index + 1), 140)
      }
    }

    function startPrefetching() {
      prefetchRoute(0)
    }

    if (win.requestIdleCallback) {
      idleId = win.requestIdleCallback(startPrefetching, { timeout: 1600 })
    } else {
      timerId = window.setTimeout(startPrefetching, 700)
    }

    return () => {
      cancelled = true
      if (idleId !== null && win.cancelIdleCallback) win.cancelIdleCallback(idleId)
      if (timerId !== null) window.clearTimeout(timerId)
    }
  }, [router, targets])

  return null
}
