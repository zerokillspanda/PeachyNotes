'use client'

import { useState } from 'react'

type Course = {
  id: number
  name: string
}

type GeneratedResult = {
  lecture_summary: string
  key_topics: string[]
  authorities_mentioned: string[]
  supplement_bubble: string[]
  used_sources: string[]
}

type RetrievedSource = {
  title: string
  chunk_index: number
  citation: string | null
  content: string
}

type Props = {
  courses: Course[]
}

export default function GenerateForm({ courses }: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState(
    courses.length > 0 ? String(courses[0].id) : ''
  )
  const [transcript, setTranscript] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GeneratedResult | null>(null)
  const [sources, setSources] = useState<RetrievedSource[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    setSources([])
    setExportMessage('')

    try {
      const response = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourseId,
          transcript,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not generate notes.')
      }

      setResult(data.result)
      setSources(data.retrieved_sources ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportToNotion = async () => {
    if (!result) return

    const courseName =
      courses.find((course) => String(course.id) === selectedCourseId)?.name ??
      'Lecture'

    setExporting(true)
    setExportMessage('')

    try {
      const response = await fetch('/api/notion/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName,
          result,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Could not export to Notion.')
      }

      setExportMessage(`Saved to Notion: ${data.pageUrl}`)
    } catch (err) {
      setExportMessage(
        err instanceof Error ? err.message : 'Could not export to Notion.'
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4 border rounded p-4">
        <div>
          <label className="block mb-1 font-medium">Choose course</label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-medium">Lecture transcript</label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste a sample lecture transcript here..."
            className="w-full border rounded px-3 py-2 min-h-[250px]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-purple-600 text-white px-4 py-2"
        >
          {loading ? 'Generating...' : 'Generate Notes'}
        </button>

        {error && <p className="text-red-600">{error}</p>}
      </form>

      {result && (
        <div className="space-y-6">
          <section className="border rounded p-4">
            <h2 className="text-xl font-semibold mb-3">Export</h2>
            <button
              onClick={handleExportToNotion}
              disabled={exporting}
              className="rounded bg-black text-white px-4 py-2"
            >
              {exporting ? 'Sending...' : 'Send to Notion'}
            </button>

            {exportMessage && <p className="mt-3 text-sm">{exportMessage}</p>}
          </section>

          <section className="border rounded p-4">
            <h2 className="text-xl font-semibold mb-2">Lecture Summary</h2>
            <p>{result.lecture_summary}</p>
          </section>

          <section className="border rounded p-4">
            <h2 className="text-xl font-semibold mb-2">Key Topics</h2>
            <ul className="list-disc pl-6">
              {result.key_topics.map((topic, index) => (
                <li key={index}>{topic}</li>
              ))}
            </ul>
          </section>

          <section className="border rounded p-4">
            <h2 className="text-xl font-semibold mb-2">Authorities Mentioned</h2>
            <ul className="list-disc pl-6">
              {result.authorities_mentioned.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="border rounded p-4 bg-yellow-50">
            <h2 className="text-xl font-semibold mb-2">
              From Course Notes: Not Clearly Covered in Class
            </h2>
            <ul className="list-disc pl-6">
              {result.supplement_bubble.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="border rounded p-4">
            <h2 className="text-xl font-semibold mb-2">Used Sources</h2>
            <ul className="list-disc pl-6">
              {result.used_sources.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="border rounded p-4">
            <h2 className="text-xl font-semibold mb-2">Retrieved Chunks</h2>
            <div className="space-y-4">
              {sources.map((source, index) => (
                <div key={index} className="border rounded p-3">
                  <p className="font-medium">
                    {source.title} — Chunk {source.chunk_index}
                  </p>
                  {source.citation && (
                    <p className="text-sm text-gray-600 mb-2">
                      Citation: {source.citation}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{source.content}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}