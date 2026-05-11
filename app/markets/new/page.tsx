'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { probsToQValues } from '@/lib/lmsr'

interface OptionRow {
  label: string
  pct: number
}

function equalSplit(n: number): number[] {
  const base = Math.floor(100 / n)
  const rem = 100 - base * n
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + rem : base))
}

export default function NewMarketPage() {
  const router = useRouter()
  const supabase = createClient()

  const [question, setQuestion] = useState('')
  const [rows, setRows] = useState<OptionRow[]>([
    { label: 'Yes', pct: 50 },
    { label: 'No', pct: 50 },
  ])
  const [closesAt, setClosesAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = rows.reduce((s, r) => s + r.pct, 0)
  const totalOk = total === 100

  function addOption() {
    if (rows.length >= 6) return
    const n = rows.length + 1
    const splits = equalSplit(n)
    setRows(prev =>
      [...prev, { label: '', pct: 0 }].map((r, i) => ({ ...r, pct: splits[i] }))
    )
  }

  function removeOption(i: number) {
    if (rows.length <= 2) return
    const next = rows.filter((_, idx) => idx !== i)
    const splits = equalSplit(next.length)
    setRows(next.map((r, idx) => ({ ...r, pct: splits[idx] })))
  }

  function updateLabel(i: number, value: string) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, label: value } : r)))
  }

  function updatePct(i: number, raw: string) {
    const val = Math.max(1, Math.min(99, parseInt(raw) || 0))
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, pct: val } : r)))
  }

  function redistribute() {
    const splits = equalSplit(rows.length)
    setRows(prev => prev.map((r, i) => ({ ...r, pct: splits[i] })))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleaned = rows.map(r => ({ ...r, label: r.label.trim() })).filter(r => r.label)
    if (cleaned.length < 2) { setError('Need at least 2 options'); return }
    if (new Set(cleaned.map(r => r.label)).size !== cleaned.length) { setError('Options must be unique'); return }
    if (!totalOk) { setError('Percentages must add up to exactly 100'); return }
    if (!closesAt) { setError('Choose a closing date'); return }


    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const probs = cleaned.map(r => r.pct / 100)
    const qValues = probsToQValues(probs, 100)

    const { data, error: insertError } = await supabase
      .from('markets')
      .insert({
        question: question.trim(),
        creator_id: user.id,
        options: cleaned.map(r => r.label),
        q_values: qValues,
        b: 100,
        closes_at: new Date(closesAt).toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push(`/markets/${data.id}`)
  }


  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm transition-colors">
            ← Dashboard
          </Link>
          <span className="text-gray-200">/</span>
          <span className="text-sm font-medium text-gray-700">New market</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-10">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Create a market</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

            {/* Question */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Question
              </label>
              <input
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Will it rain in SF this weekend?"
                required
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-gray-400"
              />
            </div>

            {/* Options + probabilities */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Options & starting odds</label>
                <button
                  type="button"
                  onClick={redistribute}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Reset to equal
                </button>
              </div>

              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={row.label}
                      onChange={e => updateLabel(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      required
                      maxLength={80}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-gray-400"
                    />
                    <div className="relative w-20">
                      <input
                        type="number"
                        value={row.pct}
                        onChange={e => updatePct(i, e.target.value)}
                        min={1}
                        max={99}
                        className={`w-full px-3 py-2 pr-6 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent tabular-nums ${
                          totalOk ? 'border-gray-300' : 'border-amber-300 bg-amber-50'
                        }`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                    {rows.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="text-gray-300 hover:text-red-400 transition-colors px-1 text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Total indicator */}
              <div className={`mt-2 text-xs flex items-center justify-end gap-1 ${totalOk ? 'text-teal-600' : 'text-amber-600'}`}>
                <span>Total: <span className="font-semibold tabular-nums">{total}%</span></span>
                {totalOk && <span>✓</span>}
                {!totalOk && <span>— must equal 100%</span>}
              </div>

              {rows.length < 6 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="mt-3 text-sm text-teal-600 hover:text-teal-800 font-medium"
                >
                  + Add option
                </button>
              )}
            </div>

            {/* Closing date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Closes at
              </label>
              <input
                type="datetime-local"
                value={closesAt}

                onChange={e => setClosesAt(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Link
              href="/"
              className="flex-1 text-center bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !totalOk}
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create market'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
