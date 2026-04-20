import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AddMaterialForm from './add-material-form'
import MaterialItemActions from './material-item-actions'

export default async function MaterialsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    redirect('/login')
  }

  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, name')
    .order('name', { ascending: true })

  const { data: materials, error: materialsError } = await supabase
    .from('course_documents')
    .select('id, title, created_at, course_id')
    .order('created_at', { ascending: false })

  const courseMap = new Map((courses ?? []).map((course) => [course.id, course.name]))

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard" className="underline">
          ← Back to dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-2">Course Materials</h1>
      <p className="mb-6">Add your college notes here so the app can learn from them.</p>

      {coursesError && <p className="text-red-600 mb-4">{coursesError.message}</p>}

      <div className="mb-10">
        <AddMaterialForm />
      </div>

      <h2 className="text-xl font-semibold mb-4">Saved Materials</h2>

      {materialsError && <p className="text-red-600 mb-4">{materialsError.message}</p>}

      {!materials || materials.length === 0 ? (
        <p>No materials yet.</p>
      ) : (
        <div className="space-y-3">
          {materials.map((material) => (
            <div key={material.id} className="border rounded p-4">
              <p className="font-medium">{material.title}</p>
              <p className="text-sm text-gray-600">
                Course: {material.course_id ? courseMap.get(material.course_id) : 'No course'}
              </p>
              <p className="text-sm text-gray-600">
                Material ID: {material.id}
              </p>
              <p className="text-sm text-gray-600">
                Created: {new Date(material.created_at).toLocaleString()}
              </p>
              <MaterialItemActions
                id={material.id}
                initialTitle={material.title}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  )
}