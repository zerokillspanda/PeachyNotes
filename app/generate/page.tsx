import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GenerateForm from './generate-form'

export default async function GeneratePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    redirect('/login')
  }

  const { data: courses } = await supabase
    .from('courses')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <main className="app-page">
      <div className="mb-6">
        <Link href="/dashboard" className="soft-link">
          ← Back to dashboard
        </Link>
      </div>

      <h1 className="page-title mb-2">Generate Notes</h1>
      <p className="mb-6">
        Paste a sample lecture transcript and let the app retrieve matching course notes.
      </p>

      <GenerateForm courses={courses ?? []} />
    </main>
  )
}