import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getPageTitle(result: any) {
  const prop = result?.properties?.title

  if (prop?.type === 'title' && Array.isArray(prop.title)) {
    return prop.title.map((item: any) => item.plain_text).join('')
  }

  for (const value of Object.values(result?.properties ?? {})) {
    const propValue = value as any
    if (propValue?.type === 'title' && Array.isArray(propValue.title)) {
      return propValue.title.map((item: any) => item.plain_text).join('')
    }
  }

  return 'Untitled page'
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { data: connection } = await supabase
    .from('notion_connections')
    .select('access_token')
    .eq('user_id', user.id)
    .single()

  if (!connection?.access_token) {
    return NextResponse.json({ error: 'Notion not connected' }, { status: 400 })
  }

  const notionRes = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      'Notion-Version': '2026-03-11',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: {
        property: 'object',
        value: 'page',
      },
      page_size: 20,
    }),
  })

  const notionData = await notionRes.json()

  if (!notionRes.ok) {
    return NextResponse.json(
      { error: notionData.message || 'Could not load Notion pages.' },
      { status: 500 }
    )
  }

  const pages = (notionData.results ?? []).map((result: any) => ({
    id: result.id,
    title: getPageTitle(result),
    url: result.url,
  }))

  return NextResponse.json({ pages })
}