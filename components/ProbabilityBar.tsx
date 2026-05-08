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
            <div className="flex justify-between text-sm mb-1">
              <span className={`font-medium ${isHighlighted ? 'text-teal-700' : 'text-gray-700'}`}>
                {option}
              </span>
              <span className={`tabular-nums font-semibold ${isLeading ? 'text-teal-600' : 'text-gray-500'}`}>
                {formatProbability(prob)}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isLeading ? 'bg-teal-500' : 'bg-gray-300'
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
