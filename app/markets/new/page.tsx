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
  const [pctDrafts, setPctDrafts] = useState<string[]>(['50', '50'])
  /** yyyy-MM-dd and HH:mm — combined for submit as local datetime */
  const [closeDate, setCloseDate] = useState('')
  const [closeTime, setCloseTime] = useState('18:00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = rows.reduce((s, r) => s + r.pct, 0)
  const totalOk = total === 100

  const setRowsWithDrafts = useCallback((nextRows: OptionRow[]) => {
    setRows(nextRows)
    setPctDrafts(nextRows.map(row => String(row.pct)))
  }, [])

  function addOption() {
    if (rows.length >= 6) return
    const n = rows.length + 1
    const splits = equalSplit(n)
    const nextRows = [...rows, { label: '', pct: 0 }].map((r, i) => ({ ...r, pct: splits[i] }))
    setRowsWithDrafts(nextRows)
  }

  function removeOption(i: number) {
    if (rows.length <= 2) return
    const next = rows.filter((_, idx) => idx !== i)
    const splits = equalSplit(next.length)
    setRowsWithDrafts(next.map((r, idx) => ({ ...r, pct: splits[idx] })))
  }

  function updateLabel(i: number, value: string) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, label: value } : r)))
  }

  function updatePctDraft(i: number, raw: string) {
    if (!/^\d{0,3}$/.test(raw)) return
    setPctDrafts(prev => prev.map((draft, idx) => (idx === i ? raw : draft)))
  }

  function commitPctDraft(i: number) {
    const raw = pctDrafts[i]?.trim() ?? ''
    const previousValue = rows[i]?.pct ?? 1
    if (!raw) {
      setPctDrafts(prev => prev.map((draft, idx) => (idx === i ? String(previousValue) : draft)))
      return
    }

    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed)) {
      setPctDrafts(prev => prev.map((draft, idx) => (idx === i ? String(previousValue) : draft)))
      return
    }

    const normalized = Math.max(1, Math.min(99, parsed))
    setRows(prev => prev.map((row, idx) => (idx === i ? { ...row, pct: normalized } : row)))
    setPctDrafts(prev => prev.map((draft, idx) => (idx === i ? String(normalized) : draft)))
  }

  function redistribute() {
    const splits = equalSplit(rows.length)
    setRowsWithDrafts(rows.map((r, i) => ({ ...r, pct: splits[i] })))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleaned = rows.map(r => ({ ...r, label: r.label.trim() })).filter(r => r.label)
    if (cleaned.length < 2) { setError('Need at least 2 options'); return }
    if (new Set(cleaned.map(r => r.label)).size !== cleaned.length) { setError('Options must be unique'); return }
    if (!totalOk) { setError('Percentages must add up to exactly 100'); return }
    if (!closeDate || !closeTime) {
      setError('Choose a closing date and time')
      return
    }


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
        closes_at: new Date(`${closeDate}T${closeTime}`).toISOString(),
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
                      {(() => {
                        const draft = pctDrafts[i] ?? String(row.pct)
                        const parsedDraft = draft === '' ? null : Number.parseInt(draft, 10)
                        const hasDraftError = parsedDraft !== null && (Number.isNaN(parsedDraft) || parsedDraft < 1 || parsedDraft > 99)

                        return (
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={draft}
                        onChange={e => updatePctDraft(i, e.target.value)}
                        onBlur={() => commitPctDraft(i)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            commitPctDraft(i)
                            e.currentTarget.blur()
                          }
                        }}
                        aria-label={`Starting odds for option ${i + 1}`}
                        className={`w-full px-3 py-2 pr-6 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent tabular-nums ${
                          hasDraftError
                            ? 'border-red-300 bg-red-50'
                            : totalOk ? 'border-gray-300' : 'border-amber-300 bg-amber-50'
                        }`}
                      />
                        )
                      })()}
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
              <p className="mt-1 text-xs text-gray-500">
                Edit percentages freely, then click away or press Enter to apply. Each option must be between 1% and 99%.
              </p>

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

            {/* Closing date + time — separate native pickers look cleaner than one datetime-local control */}
            <div className="space-y-3">
              <label id="closes-at-label" className="block text-sm font-medium text-gray-700">
                Closes at
              </label>
              <div
                role="group"
                aria-labelledby="closes-at-label"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-2xl border border-gray-200/90 bg-gradient-to-b from-white to-stone-50/80 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
              >
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Date
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teal-700/80">
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M6.5 2.8v2.5M13.5 2.8v2.5M3.5 8h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    <input
                      type="date"
                      value={closeDate}
                      onChange={e => setCloseDate(e.target.value)}
                      min={(() => {
                        const d = new Date()
                        const y = d.getFullYear()
                        const m = String(d.getMonth() + 1).padStart(2, '0')
                        const day = String(d.getDate()).padStart(2, '0')
                        return `${y}-${m}-${day}`
                      })()}
                      required
                      aria-describedby="closes-at-help"
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 shadow-inner shadow-gray-100/80 transition hover:border-teal-300/60 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25 [color-scheme:light]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Time
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-teal-700/80">
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M10 6.2V10l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    <input
                      type="time"
                      value={closeTime}
                      onChange={e => setCloseTime(e.target.value)}
                      required
                      aria-describedby="closes-at-help"
                      className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 shadow-inner shadow-gray-100/80 transition hover:border-teal-300/60 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25 [color-scheme:light]"
                    />
                  </div>
                </div>
              </div>
              <p id="closes-at-help" className="text-xs text-gray-500">
                Deadline for new bets. Uses your device&apos;s local date and time.
              </p>
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
