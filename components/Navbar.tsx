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
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-gray-900 tracking-tight">
          Answer Key
        </Link>
        <div className="flex items-center gap-4">
          {profile && (
            <>
              <span className="text-sm text-gray-500">
                <span className="font-medium text-gray-900">{profile.points_balance.toLocaleString()}</span> pts
              </span>
              <span className="text-sm text-gray-500">{profile.username}</span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
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
