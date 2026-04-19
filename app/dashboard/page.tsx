import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './logout-button'
import CreateLectureButton from './create-lecture-button'

type SearchParams = Promise<{
  notion_connected?: string
  notion_error?: string
}>

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    redirect('/login')
  }

  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, name')
    .order('name', { ascending: true })

  const { data: lectures, error: lecturesError } = await supabase
    .from('lectures')
    .select('id, title, created_at, course_id')
    .order('created_at', { ascending: false })

  const { data: notionConnection } = await supabase
    .from('notion_connections')
    .select('workspace_name, workspace_id')
    .eq('user_id', data.user.id)
    .maybeSingle()

  const courseMap = new Map(
    (courses ?? []).map((course) => [course.id, course.name])
  )

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">Logged in as: {data.user.email}</p>

      {params.notion_connected && (
        <p className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-green-700">
          Notion connected successfully.
        </p>
      )}

      {params.notion_error && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">
          Notion error: {params.notion_error}
        </p>
      )}

      <div className="grid grid-cols-4 gap-3 mb-8">
        <a href="/live" className="bg-red-50 border border-red-200 rounded-xl p-3 text-center hover:shadow-sm transition">
          <p className="text-base mb-1">🔴</p>
          <p className="text-xs font-medium">Live Record</p>
        </a>
        <a href="/audio" className="bg-white border rounded-xl p-3 text-center hover:shadow-sm transition">
          <p className="text-base mb-1">🎙️</p>
          <p className="text-xs font-medium">Upload Audio</p>
        </a>
        <a href="/materials" className="bg-white border rounded-xl p-3 text-center hover:shadow-sm transition">
          <p className="text-base mb-1">📄</p>
          <p className="text-xs font-medium">Materials</p>
        </a>
        <a href="/search" className="bg-white border rounded-xl p-3 text-center hover:shadow-sm transition">
          <p className="text-base mb-1">🔍</p>
          <p className="text-xs font-medium">Search</p>
        </a>
      </div>

      <section className="mb-8 border rounded-xl p-4 bg-white">
        <h2 className="text-lg font-semibold mb-2">Notion Connection</h2>
        {notionConnection ? (
          <div className="space-y-1 text-sm text-gray-700">
            <p>✅ Connected to <span className="font-medium">{notionConnection.workspace_name || 'Unnamed workspace'}</span></p>
            <p className="text-xs text-gray-400">Workspace ID: {notionConnection.workspace_id}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Connect your Notion workspace so this app can create lecture notes there.
            </p>
            <a
              href="/api/notion/connect"
              className="inline-block rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 transition"
            >
              Connect Notion
            </a>
          </div>
        )}
      </section>

      <div className="flex gap-3 mb-8">
        <CreateLectureButton userId={data.user.id} courses={courses ?? []} />
        <LogoutButton />
      </div>

      {coursesError && (
        <p className="text-red-600 mb-4">{coursesError.message}</p>
      )}

      <h2 className="text-xl font-semibold mb-4">Your Lectures</h2>

      {lecturesError && (
        <p className="text-red-600 mb-4">{lecturesError.message}</p>
      )}

      {!lectures || lectures.length === 0 ? (
        <div className="border rounded-xl p-8 text-center text-gray-400 text-sm bg-white">
          No lectures yet. Hit <strong>Live Record</strong> or <strong>Upload Audio</strong> to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {lectures.map((lecture) => (
            <a
              key={lecture.id}
              href={`/lectures/${lecture.id}`}
              className="block border rounded-xl p-4 bg-white hover:shadow-sm hover:border-gray-300 transition-all"
            >
              <p className="font-medium">{lecture.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {lecture.course_id ? courseMap.get(lecture.course_id) : 'No course'} ·{' '}
                {new Date(lecture.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
              <p className="text-xs text-blue-500 mt-2">View notes →</p>
            </a>
          ))}
        </div>
      )}
    </main>
  )
}
