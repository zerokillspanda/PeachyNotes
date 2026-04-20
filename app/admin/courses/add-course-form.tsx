'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddCourseForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!name.trim()) {
      setError('Course name is required.')
      return
    }

    setIsSaving(true)

    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Could not create course.')
      }

      setName('')
      setMessage(`Created course: ${data.course?.name ?? 'Unnamed course'}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create course.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel">
      <h2 className="text-xl font-semibold">Add New Course</h2>
      <p className="mt-2 text-sm text-[#5f4f40]">
        Courses added here become available to all users when creating lectures.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Constitutional Law"
          className="min-w-[260px] flex-1 rounded-xl border border-[#dcc9b8] bg-[#fffaf5] px-4 py-2 text-sm text-[#2f2119] shadow-sm focus:border-[#c7ab95] focus:outline-none"
        />
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-xl bg-[#3a6294] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#304f78] disabled:opacity-60"
        >
          {isSaving ? 'Adding...' : 'Add course'}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
    </form>
  )
}
