'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ThemeSwitcher from '@/components/ThemeSwitcher'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="ak-page relative flex flex-col items-center justify-center px-4">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeSwitcher compact />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">Answer Key</h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">A quiet prediction market for friends.</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-teal-200 bg-teal-50/85 p-6 text-center dark:border-teal-700/50 dark:bg-teal-950/35">
            <div className="mb-2 text-2xl" aria-hidden="true">✉️</div>
            <p className="font-medium text-teal-900 dark:text-teal-200">Check your email</p>
            <p className="mt-1 text-sm text-teal-700 dark:text-teal-300">
              We sent a magic link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="ak-card p-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-semibold text-stone-700 dark:text-stone-300">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="ak-field"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="ak-button-primary w-full"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
