'use client'

import { useEffect, useState } from 'react'

type NotionPage = {
  id: string
  title: string
  url: string
}

type Props = {
  initialParentPageId: string
}

export default function NotionPagePicker({ initialParentPageId }: Props) {
  const [pages, setPages] = useState<NotionPage[]>([])
  const [selectedPageId, setSelectedPageId] = useState(initialParentPageId)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadPages() {
      try {
        const res = await fetch('/api/notion/pages')
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Could not load pages.')
        }

        setPages(data.pages ?? [])
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Could not load pages.')
      } finally {
        setLoading(false)
      }
    }

    loadPages()
  }, [])

  const handleSave = async () => {
    if (!selectedPageId) {
      setMessage('Please choose a parent page.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const res = await fetch('/api/notion/save-parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPageId: selectedPageId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Could not save parent page.')
      }

      setMessage('Parent page saved.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save parent page.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="border rounded p-4 space-y-4">
      <h2 className="text-lg font-semibold">Choose parent page</h2>
      <p className="text-sm text-gray-700">
        New lecture-note pages will be created under this Notion page.
      </p>

      {loading ? (
        <p>Loading pages...</p>
      ) : pages.length === 0 ? (
        <p>No shared pages found. Share a page with your integration in Notion, then refresh.</p>
      ) : (
        <>
          <select
            value={selectedPageId}
            onChange={(e) => setSelectedPageId(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select a page</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-blue-600 text-white px-4 py-2"
          >
            {saving ? 'Saving...' : 'Save parent page'}
          </button>
        </>
      )}

      {message && <p className="text-sm">{message}</p>}
    </section>
  )
}