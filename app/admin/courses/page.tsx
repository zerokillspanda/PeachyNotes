import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AddCourseForm from './add-course-form'

const ADMIN_USER_ID = '7e49b324-6aae-4c84-9703-bd94822eef1a'

type Course = {
  id: number
  name: string
}

export default async function AdminCoursesPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  if (user.id !== ADMIN_USER_ID) {
    notFound()
  }

  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <main className="app-page max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard" className="soft-link">
          ← Back to dashboard
        </Link>
      </div>

      <h1 className="page-title">Admin · Course Management</h1>
      <p className="page-subtitle">
        This page is restricted to your admin account.
      </p>

      <div className="mt-8">
        <AddCourseForm />
      </div>

      <section className="panel mt-8">
        <h2 className="text-xl font-semibold">Existing Courses</h2>

        {coursesError ? (
          <p className="mt-3 text-sm text-red-700">{coursesError.message}</p>
        ) : courses && courses.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-[#2f2119]">
            {(courses as Course[]).map((course) => (
              <li key={course.id} className="rounded-lg border border-[#e5d6c8] bg-[#fffdf9] px-3 py-2">
                {course.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#5f4f40]">No courses found.</p>
        )}
      </section>
    </main>
  )
}
