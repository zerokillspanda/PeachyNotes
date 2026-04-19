import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PeachyNotes",
  description: "AI-powered legal lecture notes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-gray-50 text-gray-900">
        <aside className="hidden md:flex w-52 shrink-0 flex-col border-r bg-white px-3 py-6">
          <div className="mb-8 px-2">
            <p className="text-base font-bold tracking-tight">🍑 PeachyNotes</p>
          </div>
          <nav className="flex flex-col gap-0.5 text-sm">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/live">🔴 Live Record</NavLink>
            <NavLink href="/audio">Upload Audio</NavLink>
            <NavLink href="/materials">Materials</NavLink>
            <NavLink href="/generate">Generate Notes</NavLink>
            <NavLink href="/search">Search</NavLink>
            <div className="my-3 border-t" />
            <NavLink href="/notion">Notion Sync</NavLink>
          </nav>
        </aside>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      {children}
    </Link>
  );
}
