import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_USER_ID = '7e49b324-6aae-4c84-9703-bd94822eef1a'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError('Not authenticated.', 401)
    }

    if (user.id !== ADMIN_USER_ID) {
      return jsonError('Admin access required.', 403)
    }

    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''

    if (!name) {
      return jsonError('Course name is required.')
    }

    const { data: existing } = await supabase
      .from('courses')
      .select('id, name')
      .ilike('name', name)
      .maybeSingle()

    if (existing) {
      return jsonError('A course with this name already exists.')
    }

    const { data: createdCourse, error: createError } = await supabase
      .from('courses')
      .insert({ name })
      .select('id, name')
      .single()

    if (createError || !createdCourse) {
      return jsonError(createError?.message || 'Could not create course.', 500)
    }

    return NextResponse.json({ success: true, course: createdCourse })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Something went wrong.'
    return jsonError(message, 500)
  }
}
