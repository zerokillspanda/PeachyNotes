'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteLectureButton({ lectureId }: { lectureId: number }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    const confirmed = window.confirm(
      'Delete this lecture and all saved chunks/notes? This cannot be undone.'
    )

    if (!confirmed) return

    setError('')
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/lectures/${lectureId}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Could not delete lecture.')
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete lecture.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
      >
        {isDeleting ? 'Deleting lecture...' : 'Delete lecture'}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  )
}
