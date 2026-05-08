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
  const [timeLeft, setTimeLeft] = useState<number>(
    new Date(closesAt).getTime() - Date.now()
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(new Date(closesAt).getTime() - Date.now())
    }, 30000)
    return () => clearInterval(interval)
  }, [closesAt])

  const isExpired = timeLeft <= 0
  const isUrgent = timeLeft > 0 && timeLeft < 3600000 // < 1 hour

  return (
    <span
      className={`text-xs font-medium ${
        isExpired
          ? 'text-gray-400'
          : isUrgent
          ? 'text-amber-600'
          : 'text-gray-500'
      }`}
    >
      {isExpired ? 'Closed' : `closes in ${formatTimeLeft(timeLeft)}`}
    </span>
  )
}
