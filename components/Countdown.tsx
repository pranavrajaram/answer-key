'use client'

import { useEffect, useState } from 'react'

interface CountdownProps {
  closesAt: string
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'Closed'

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default function Countdown({ closesAt }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  useEffect(() => {
    function updateTimeLeft() {
      setTimeLeft(new Date(closesAt).getTime() - Date.now())
    }

    updateTimeLeft()
    const interval = setInterval(() => {
      updateTimeLeft()
    }, 30000)
    return () => clearInterval(interval)
  }, [closesAt])

  const isExpired = timeLeft !== null && timeLeft <= 0
  const isUrgent = timeLeft !== null && timeLeft > 0 && timeLeft < 3600000 // < 1 hour

  return (
    <span
      className={`ak-badge ${
        isExpired
          ? 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500'
          : isUrgent
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
          : 'bg-stone-100/80 text-stone-500 dark:bg-stone-800/90 dark:text-stone-400'
      }`}
    >
      {timeLeft === null ? 'closes soon' : isExpired ? 'Closed' : `closes in ${formatTimeLeft(timeLeft)}`}
    </span>
  )
}
