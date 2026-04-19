import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin

  const errorParam = url.searchParams.get('error')
  const code = url.searchParams.get('code')

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/dashboard?notion_error=${encodeURIComponent(errorParam)}`, origin)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/dashboard?notion_error=missing_code', origin)
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', origin))
  }

  const encoded = Buffer.from(
    `${process.env.NOTION_CLIENT_ID!}:${process.env.NOTION_CLIENT_SECRET!}`
  ).toString('base64')

  const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${encoded}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.NOTION_REDIRECT_URI!,
    }),
  })

  const tokenData = await tokenResponse.json()

  if (!tokenResponse.ok) {
    const message =
      tokenData?.message || tokenData?.error || 'notion_token_exchange_failed'

    return NextResponse.redirect(
      new URL(`/dashboard?notion_error=${encodeURIComponent(message)}`, origin)
    )
  }

  const { error: dbError } = await supabase.from('notion_connections').upsert(
    {
      user_id: user.id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      workspace_id: tokenData.workspace_id ?? null,
      workspace_name: tokenData.workspace_name ?? null,
      bot_id: tokenData.bot_id ?? null,
    },
    {
      onConflict: 'user_id',
    }
  )

  if (dbError) {
    return NextResponse.redirect(
      new URL(`/dashboard?notion_error=${encodeURIComponent(dbError.message)}`, origin)
    )
  }

  return NextResponse.redirect(new URL('/dashboard?notion_connected=1', origin))
}