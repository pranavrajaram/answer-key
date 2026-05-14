'use client'

import { lmsrProb, formatProbability } from '@/lib/lmsr'

interface ProbabilityBarProps {
  options: string[]
  qValues: number[]
  b: number
  highlightIndex?: number
}

export default function ProbabilityBar({ options, qValues, b, highlightIndex }: ProbabilityBarProps) {
  const probs = options.map((_, i) => lmsrProb(qValues, i, b))
  const leadingIndex = probs.indexOf(Math.max(...probs))

  return (
    <div className="space-y-2">
      {options.map((option, i) => {
        const prob = probs[i]
        const isLeading = i === leadingIndex
        const isHighlighted = highlightIndex === i

        return (
          <div key={option}>
            <div className="mb-1 flex items-start justify-between gap-3 text-sm leading-snug">
              <span
                className={`min-w-0 font-medium ${isHighlighted ? 'text-teal-700 dark:text-teal-400' : 'text-stone-700 dark:text-stone-300'}`}
              >
                {option}
              </span>
              <span
                className={`shrink-0 tabular-nums font-semibold ${isLeading ? 'text-teal-700 dark:text-teal-400' : 'text-stone-500 dark:text-stone-400'}`}
              >
                {formatProbability(prob)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stone-200/70 dark:bg-stone-700/80">
              <div
                className={`h-full rounded-full ${
                  isLeading ? 'bg-teal-600 dark:bg-teal-500' : 'bg-stone-300 dark:bg-stone-600'
                }`}
                style={{ width: `${prob * 100}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
