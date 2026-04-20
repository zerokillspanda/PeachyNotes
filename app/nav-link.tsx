'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Link
      href={href}
      className={[
        'rounded-xl px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-[#f2eae1] text-[#2f2119] shadow-[inset_0_0_0_1px_rgba(134,103,78,0.08)]'
          : 'text-[#6b5848] hover:bg-[#f6eee5] hover:text-[#2f2119]',
      ].join(' ')}
    >
      {children}
    </Link>
  )
}
