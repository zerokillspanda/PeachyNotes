import type { Metadata } from 'next'
import './globals.css'
import NavLink from './nav-link'

export const metadata: Metadata = {
  title: 'PeachyNotes',
  description: 'AI-powered legal lecture notes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen text-[#261b13]">
        <aside className="hidden min-h-screen w-60 shrink-0 flex-col border-r border-[#eadbcb] bg-[#fcf7f2]/95 px-4 py-7 backdrop-blur md:flex">
          <div className="mb-8 px-2">
            <p className="text-[2rem] leading-none">🍑</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">PeachyNotes</p>
          </div>
          <nav className="flex flex-col gap-1">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/live">● Live Record</NavLink>
            <NavLink href="/audio">Upload Audio</NavLink>
            <NavLink href="/materials">Materials</NavLink>
            <NavLink href="/generate">Generate Notes</NavLink>
            <NavLink href="/search">Search</NavLink>
            <div className="my-3 border-t border-[#e9ddd2]" />
            <NavLink href="/notion">Notion Sync</NavLink>
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  )
}
