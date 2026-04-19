import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">Legal Lecture Notes</h1>
        <div className="space-x-4">
          <Link href="/signup" className="underline">
            Sign up
          </Link>
          <Link href="/login" className="underline">
            Log in
          </Link>
        </div>
      </div>
    </main>
  )
}