import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { lmsrProb, formatProbability } from '@/lib/lmsr'
import Navbar from '@/components/Navbar'
import ResolvePanel from '@/components/ResolvePanel'

export const revalidate = 0

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ResolvePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: market }, { data: profile }, { data: bets }] = await Promise.all([
    supabase.from('markets').select('*').eq('id', id).single(),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('bets').select('*').eq('market_id', id),
  ])

  if (!market) notFound()
  if (market.creator_id !== user.id) redirect(`/markets/${id}`)
  if (market.resolved_option) redirect(`/markets/${id}`)

  const totalPot = (bets ?? []).reduce((s: number, b: { amount: number }) => s + b.amount, 0)

  return (
    <div className="ak-page">
      <Navbar profile={profile} />

      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-sm text-stone-400 dark:text-stone-500">
          <Link href={`/markets/${id}`} className="transition-colors hover:text-stone-800 dark:hover:text-stone-200">
            ← Market
          </Link>
          <span>/</span>
          <span className="text-stone-600 dark:text-stone-300">Resolve</span>
        </div>

        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">Resolve market</h1>
        <p className="mb-6 text-sm leading-relaxed text-stone-500 dark:text-stone-400">{market.question}</p>

        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/85 p-4 text-sm text-amber-800 dark:border-amber-800/45 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>This is permanent.</strong> Once you resolve, all winning bets get paid out and the market closes. There&apos;s no undo.
        </div>

        <div className="ak-card mb-4 p-5">
          <p className="ak-section-label mb-3">Current probabilities</p>
          <div className="space-y-2">
            {market.options.map((opt: string, i: number) => {
              const prob = lmsrProb(market.q_values, i, market.b)
              return (
                <div key={opt} className="flex items-center justify-between text-sm">
                  <span className="text-stone-700 dark:text-stone-300">{opt}</span>
                  <span className="font-semibold text-stone-900 tabular-nums dark:text-stone-100">
                    {formatProbability(prob)}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 border-t border-stone-200/70 pt-3 text-xs text-stone-400 dark:border-stone-700/60 dark:text-stone-500">
            Total pot: {totalPot} pts · {(bets ?? []).length} bets
          </p>
        </div>

        <ResolvePanel market={market} bets={bets ?? []} />
      </main>
    </div>
  )
}
