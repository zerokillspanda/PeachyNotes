import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NotionPagePicker from './notion-page-picker'

export default async function NotionPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    redirect('/login')
  }

  const { data: connection } = await supabase
    .from('notion_connections')
    .select('workspace_name, workspace_id, parent_page_id')
    .eq('user_id', data.user.id)
    .maybeSingle()

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard" className="underline">
          ← Back to dashboard
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-2">Notion Settings</h1>

      {!connection ? (
        <div className="space-y-3">
          <p>You have not connected Notion yet.</p>
          <a
            href="/api/notion/connect"
            className="inline-block rounded bg-black px-4 py-2 text-white"
          >
            Connect Notion
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="border rounded p-4">
            <p className="font-medium">Connected workspace</p>
            <p>{connection.workspace_name || 'Unnamed workspace'}</p>
            <p className="text-sm text-gray-600">{connection.workspace_id}</p>
          </div>

          <NotionPagePicker initialParentPageId={connection.parent_page_id ?? ''} />
        </div>
      )}
    </main>
  )
}