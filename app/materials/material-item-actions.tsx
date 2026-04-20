'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type MaterialItemActionsProps = {
  id: number
  initialTitle: string
}

export default function MaterialItemActions({
  id,
  initialTitle,
}: MaterialItemActionsProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(initialTitle)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleRename() {
    setError('')
    setMessage('')

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Title cannot be empty.')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(`/api/materials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not rename material.')

      setMessage('Name updated successfully.')
      setIsEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename material.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Are you sure you want to delete this material? This cannot be undone.',
    )

    if (!confirmed) return

    setError('')
    setMessage('')
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/materials/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not delete material.')

      setMessage('Material deleted successfully.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete material.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border px-3 py-2"
            placeholder="New material name"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRename}
              disabled={isSaving}
              className="rounded-md bg-black px-3 py-2 text-white disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save name'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTitle(initialTitle)
                setIsEditing(false)
                setError('')
              }}
              className="rounded-md border px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTitle(initialTitle)
              setIsEditing(true)
              setMessage('')
              setError('')
            }}
            className="rounded-md border px-3 py-2"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-md border border-red-400 px-3 py-2 text-red-700 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
