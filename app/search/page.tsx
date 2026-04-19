import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SearchParams = Promise<{
  q?: string
  course?: string
}>

type JoinedResult = {
  id: number
  chunk_index: number
  content: string
  citation: string | null
  course_documents: {
    title: string
    course_id: number
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''
  const selectedCourseId = params.course ?? ''

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    redirect('/login')
  }

  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('id, name')
    .order('name', { ascending: true })

  let results: JoinedResult[] = []
  let resultsError: string | null = null

  if (query && selectedCourseId) {
    const { data: foundChunks, error } = await supabase
      .from('course_chunks')
      .select('id, chunk_index, content, citation, course_documents!inner(title, course_id)')
      .eq('course_documents.course_id', Number(selectedCourseId))
      .ilike('content', `%${query}%`)
      .limit(20)

    if (error) {
      resultsError = error.message
    } else {
      results = (foundChunks as unknown as JoinedResult[]) ?? []
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard" className="underline">
          ← Back to dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-2">Search Course Materials</h1>
      <p className="mb-6">
        Test retrieval by searching the course notes you already saved.
      </p>

      {coursesError && <p className="text-red-600 mb-4">{coursesError.message}</p>}

      <form method="get" className="space-y-4 border rounded p-4 mb-8">
        <div>
          <label className="block mb-1 font-medium">Choose course</label>
          <select
            name="course"
            defaultValue={selectedCourseId}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select a course</option>
            {(courses ?? []).map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">Search term</label>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Example: consideration"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-blue-600 text-white px-4 py-2"
        >
          Search
        </button>
      </form>

      {resultsError && <p className="text-red-600 mb-4">{resultsError}</p>}

      {query && selectedCourseId && (
        <h2 className="text-xl font-semibold mb-4">
          Results for “{query}”
        </h2>
      )}

      {!query || !selectedCourseId ? (
        <p>Choose a course and enter a search term to test retrieval.</p>
      ) : results.length === 0 ? (
        <p>No matching chunks found.</p>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.id} className="border rounded p-4">
              <p className="font-medium mb-2">
                {result.course_documents.title} — Chunk {result.chunk_index}
              </p>
              {result.citation && (
                <p className="text-sm text-gray-600 mb-2">
                  Citation: {result.citation}
                </p>
              )}
              <p className="whitespace-pre-wrap">{result.content}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}