import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const origin = new URL(request.url).origin

  if (!user) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  const params = new URLSearchParams({
    owner: 'user',
    client_id: process.env.NOTION_CLIENT_ID!,
    redirect_uri: process.env.NOTION_REDIRECT_URI!,
    response_type: 'code',
  })

  const authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`

  return NextResponse.redirect(authUrl)
}