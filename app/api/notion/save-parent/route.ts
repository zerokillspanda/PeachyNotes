import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const body = await request.json()
  const parentPageId = String(body.parentPageId ?? '').trim()

  if (!parentPageId) {
    return NextResponse.json({ error: 'Parent page is required.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('notion_connections')
    .update({ parent_page_id: parentPageId })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}