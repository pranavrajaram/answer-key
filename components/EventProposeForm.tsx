'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EVENT_PRESETS, EVENT_PRESET_BY_KEY, multiplierLabel } from '@/lib/stockEvents'

interface EventProposeFormProps {
  stockId: string
  ticker: string
}

export default function EventProposeForm({ stockId, ticker }: EventProposeFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [presetKey, setPresetKey] = useState('new_job')
  const [note, setNote] = useState('')
  const [customPct, setCustomPct] = useState(10)
  const [customDividend, setCustomDividend] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const preset = EVENT_PRESET_BY_KEY[presetKey]
  const isCustom = presetKey === 'custom'

  const multiplier = isCustom ? 1 + customPct / 100 : preset.multiplier
  const dividend = isCustom ? Math.max(0, Math.round(customDividend)) : preset.dividendPerShare
  const label = isCustom
    ? note.trim() || 'Custom event'
    : note.trim()
      ? `${preset.label} — ${note.trim()}`
      : preset.label

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.rpc('propose_event', {
      p_stock_id: stockId,
      p_type: presetKey,
      p_label: label,
      p_multiplier: multiplier,
      p_dividend: dividend,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      router.refresh()
      setSuccess(false)
      setOpen(false)
      setNote('')
    }, 1000)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="ak-button-secondary w-full py-2.5">
        + Log a life event for ${ticker}
      </button>
    )
  }

  return (
    <div className="ak-card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-stone-900 dark:text-stone-100">Log an event</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-sm text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
        >
          Cancel
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-stone-500 dark:text-stone-400">What happened?</p>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPresetKey(p.key)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                presetKey === p.key
                  ? 'border-teal-500/70 bg-teal-50 text-teal-900 dark:border-teal-400/60 dark:bg-teal-950/35 dark:text-teal-100'
                  : 'border-stone-200 bg-white/70 text-stone-700 hover:border-stone-300 dark:border-stone-600/70 dark:bg-stone-900/50 dark:text-stone-200'
              }`}
            >
              <span>{p.emoji}</span>
              <span className="min-w-0 truncate">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isCustom ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-stone-500 dark:text-stone-400">Price change %</span>
            <input
              type="number"
              value={customPct}
              onChange={e => setCustomPct(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-stone-200 bg-white/70 px-2 py-1.5 text-sm tabular-nums dark:border-stone-600/70 dark:bg-stone-900/50 dark:text-stone-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-stone-500 dark:text-stone-400">Dividend / share</span>
            <input
              type="number"
              min={0}
              value={customDividend}
              onChange={e => setCustomDividend(Number(e.target.value) || 0)}
              className="w-full rounded-lg border border-stone-200 bg-white/70 px-2 py-1.5 text-sm tabular-nums dark:border-stone-600/70 dark:bg-stone-900/50 dark:text-stone-100"
            />
          </label>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200/80 bg-stone-50/80 px-3 py-2 text-sm dark:border-stone-700/60 dark:bg-stone-900/40">
          <span className="text-stone-500 dark:text-stone-400">Effect: </span>
          <span className={`font-semibold ${preset.kind === 'up' ? 'text-teal-600 dark:text-teal-400' : preset.kind === 'down' ? 'text-red-500 dark:text-red-400' : 'text-stone-700 dark:text-stone-200'}`}>
            {multiplierLabel(preset.multiplier)}
            {preset.dividendPerShare > 0 && ` · ${preset.dividendPerShare} pts/share dividend`}
          </span>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-stone-500 dark:text-stone-400">
          Note {isCustom ? '(describe the event)' : '(optional)'}
        </span>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={120}
          placeholder={isCustom ? 'e.g. Signed with a startup' : 'add context…'}
          className="w-full rounded-lg border border-stone-200 bg-white/70 px-3 py-1.5 text-sm dark:border-stone-600/70 dark:bg-stone-900/50 dark:text-stone-100"
        />
      </label>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-center text-sm text-teal-700 dark:border-teal-700/50 dark:bg-teal-950/35 dark:text-teal-300">
          Proposed! Needs one more confirmation to apply.
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || (isCustom && !note.trim())}
        className="ak-button-primary w-full py-2.5"
      >
        {loading ? 'Proposing…' : 'Propose event'}
      </button>
      <p className="text-center text-xs text-stone-400 dark:text-stone-500">
        Events apply once 2 people confirm (or an admin).
      </p>
    </div>
  )
}
