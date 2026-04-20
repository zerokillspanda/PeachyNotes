import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) return jsonError('Not authenticated.', 401)

    const { id } = await context.params
    const documentId = Number(id)
    if (!Number.isFinite(documentId)) return jsonError('Invalid material ID.')

    const { title } = await request.json()
    const trimmedTitle = typeof title === 'string' ? title.trim() : ''

    if (!trimmedTitle) return jsonError('Title cannot be empty.')

    const { data: updatedDocument, error: updateError } = await supabase
      .from('course_documents')
      .update({ title: trimmedTitle })
      .eq('id', documentId)
      .eq('uploaded_by', user.id)
      .select('id, title')
      .single()

    if (updateError || !updatedDocument) {
      return jsonError('Material not found or you do not have permission.', 404)
    }

    return NextResponse.json({ success: true, material: updatedDocument })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return jsonError(message, 500)
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) return jsonError('Not authenticated.', 401)

    const { id } = await context.params
    const documentId = Number(id)
    if (!Number.isFinite(documentId)) return jsonError('Invalid material ID.')

    const { data: ownedDocument, error: documentCheckError } = await supabase
      .from('course_documents')
      .select('id')
      .eq('id', documentId)
      .eq('uploaded_by', user.id)
      .single()

    if (documentCheckError || !ownedDocument) {
      return jsonError('Material not found or you do not have permission.', 404)
    }

    const { error: deleteChunksError } = await supabase
      .from('course_chunks')
      .delete()
      .eq('document_id', documentId)

    if (deleteChunksError) {
      return jsonError(deleteChunksError.message || 'Could not delete material chunks.', 500)
    }

    const { error: deleteDocumentError } = await supabase
      .from('course_documents')
      .delete()
      .eq('id', documentId)
      .eq('uploaded_by', user.id)

    if (deleteDocumentError) {
      return jsonError(deleteDocumentError.message || 'Could not delete material.', 500)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return jsonError(message, 500)
  }
}
