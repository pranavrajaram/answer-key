'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/types'

interface NavbarProps {
  profile: Profile | null
}

export default function Navbar({ profile }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-[var(--ak-bg)] dark:border-stone-700/60">
      <div className="ak-container flex h-16 items-center justify-between">
        <Link
          href="/"
          prefetch
          className="font-semibold tracking-tight text-stone-950 transition-colors hover:text-teal-800 dark:text-stone-100 dark:hover:text-teal-300"
        >
          Answer Key
        </Link>
        <div className="flex items-center gap-3 sm:gap-4">
          {profile && (
            <>
              <span className="rounded-full border border-stone-200/80 bg-white/70 px-3 py-1 text-sm text-stone-500 shadow-sm dark:border-stone-600/60 dark:bg-stone-900/70 dark:text-stone-400 dark:shadow-none">
                <span className="font-semibold text-stone-950 dark:text-stone-100">
                  {profile.points_balance.toLocaleString()}
                </span>{' '}
                pts
              </span>
              <span className="hidden text-sm text-stone-500 dark:text-stone-400 sm:inline">{profile.username}</span>
              <button
                onClick={handleSignOut}
                className="text-sm text-stone-400 transition-colors hover:text-stone-800 dark:hover:text-stone-200"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
