'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-xl bg-[#ba5e47] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#9f4d39]"
    >
      Log out
    </button>
  )
}