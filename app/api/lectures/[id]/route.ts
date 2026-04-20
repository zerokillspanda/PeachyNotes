import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const lectureId = Number(id)

    if (!lectureId || Number.isNaN(lectureId)) {
      return jsonError('Invalid lecture id.')
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError('Not authenticated.', 401)
    }

    const { data: lecture, error: lectureError } = await supabase
      .from('lectures')
      .select('id')
      .eq('id', lectureId)
      .eq('user_id', user.id)
      .single()

    if (lectureError || !lecture) {
      return jsonError('Lecture not found.', 404)
    }

    const { error: chunksError } = await supabase
      .from('lecture_chunks')
      .delete()
      .eq('lecture_id', lectureId)

    if (chunksError) {
      return jsonError(chunksError.message || 'Could not delete lecture chunks.', 500)
    }

    const { error: stateError } = await supabase
      .from('lecture_state')
      .delete()
      .eq('lecture_id', lectureId)

    if (stateError) {
      return jsonError(stateError.message || 'Could not delete lecture state.', 500)
    }

    const { error: lectureDeleteError } = await supabase
      .from('lectures')
      .delete()
      .eq('id', lectureId)
      .eq('user_id', user.id)

    if (lectureDeleteError) {
      return jsonError(lectureDeleteError.message || 'Could not delete lecture.', 500)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Something went wrong.'
    return jsonError(message, 500)
  }
}
