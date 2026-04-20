import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from './logout-button'
import CreateLectureButton from './create-lecture-button'

type SearchParams = Promise<{
  notion_connected?: string
  notion_error?: string
}>

const quickActions = [
  { href: '/live', icon: '🎙️', label: 'Start Live Recording', tone: 'bg-[color:var(--accent-peach)]/70' },
  { href: '/audio', icon: '☁️', label: 'Upload Audio', tone: 'bg-[color:var(--accent-blue)]/70' },
  { href: '/materials', icon: '📄', label: 'Materials', tone: 'bg-[color:var(--accent-green)]/70' },
  { href: '/search', icon: '🔎', label: 'Search', tone: 'bg-[color:var(--accent-lavender)]/70' },
]

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

  const courseMap = new Map((courses ?? []).map((course) => [course.id, course.name]))

  return (
    <main className="app-page max-w-4xl">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Logged in as: {data.user.email}</p>

      {params.notion_connected && (
        <p className="mb-4 mt-6 rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 text-emerald-800">
          Notion connected successfully.
        </p>
      )}

      {params.notion_error && (
        <p className="mb-4 mt-6 rounded-xl border border-red-300/70 bg-red-50 p-3 text-red-700">
          Notion error: {params.notion_error}
        </p>
      )}

      <div className="mt-7 grid gap-3 md:grid-cols-4">
        {quickActions.map((action) => (
          <a
            key={action.href}
            href={action.href}
            className={`rounded-2xl border border-[#e5d6c8] p-4 text-center shadow-[0_6px_16px_rgba(36,25,15,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(36,25,15,0.12)] ${action.tone}`}
          >
            <p className="text-lg">{action.icon}</p>
            <p className="mt-1 text-sm font-semibold text-[#2f2119]">{action.label}</p>
          </a>
        ))}
      </div>

      <section className="panel mt-8">
        <h2 className="text-3xl font-semibold tracking-tight">Notion Connection</h2>
        {notionConnection ? (
          <div className="mt-3 space-y-1 text-sm text-[#5f4f40]">
            <p>
              ✅ Connected to <span className="font-semibold">{notionConnection.workspace_name || 'Unnamed workspace'}</span>
            </p>
            <p className="text-xs opacity-70">Workspace ID: {notionConnection.workspace_id}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-[#5f4f40]">
              Connect your Notion workspace so this app can create lecture notes there.
            </p>
            <a
              href="/api/notion/connect"
              className="inline-block rounded-xl bg-[#1f140d] px-4 py-2 text-sm text-white shadow-sm transition hover:bg-[#352318]"
            >
              Connect Notion
            </a>
          </div>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-start gap-3">
        <CreateLectureButton userId={data.user.id} courses={courses ?? []} />
        <LogoutButton />
      </div>

      {coursesError && <p className="mb-4 mt-4 text-red-700">{coursesError.message}</p>}

      <h2 className="mt-10 text-4xl font-semibold tracking-tight">Your Lectures</h2>

      {lecturesError && <p className="mb-4 mt-4 text-red-700">{lecturesError.message}</p>}

      {!lectures || lectures.length === 0 ? (
        <div className="panel mt-4 text-center text-[#5f4f40]">
          No lectures yet. Hit <strong className="font-semibold text-[#2f2119]">Live Record</strong> or{' '}
          <strong className="font-semibold text-[#2f2119]">Upload Audio</strong> to get started.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {lectures.map((lecture) => (
            <a
              key={lecture.id}
              href={`/lectures/${lecture.id}`}
              className="panel block transition hover:-translate-y-0.5 hover:border-[#dbc5b3]"
            >
              <p className="text-lg font-semibold text-[#2f2119]">{lecture.title}</p>
              <p className="mt-1 text-sm text-[#6b5848]">
                {lecture.course_id ? courseMap.get(lecture.course_id) : 'No course'} ·{' '}
                {new Date(lecture.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
              <p className="mt-2 text-xs font-semibold text-[#6c5dd3]">View notes →</p>
            </a>
          ))}
        </div>
      )}
    </main>
  )
}
