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
    <div className="min-h-screen bg-stone-50">
      <Navbar profile={profile} />

      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href={`/markets/${id}`} className="hover:text-gray-700 transition-colors">
            ← Market
          </Link>
          <span>/</span>
          <span className="text-gray-600">Resolve</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-1">Resolve market</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{market.question}</p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-6">
          <strong>This is permanent.</strong> Once you resolve, all winning bets get paid out and the market closes. There's no undo.
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <p className="text-xs font-medium text-gray-500 mb-3">Current probabilities</p>
          <div className="space-y-2">
            {market.options.map((opt: string, i: number) => {
              const prob = lmsrProb(market.q_values, i, market.b)
              return (
                <div key={opt} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{opt}</span>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {formatProbability(prob)}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
            Total pot: {totalPot} pts · {(bets ?? []).length} bets
          </p>
        </div>

        <ResolvePanel market={market} bets={bets ?? []} />
      </main>
    </div>
  )
}
