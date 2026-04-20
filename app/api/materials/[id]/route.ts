import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_USER_ID = "7e49b324-6aae-4c84-9703-bd94822eef1a";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// DELETE /api/materials/[id] — deletes a material and all its chunks
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return jsonError("Not authenticated.", 401);
  if (user.id !== ADMIN_USER_ID) return jsonError("Not authorised.", 403);

  const documentId = Number(id);
  if (isNaN(documentId)) return jsonError("Invalid material ID.");

  const { error: chunksError } = await supabase
    .from("course_chunks")
    .delete()
    .eq("document_id", documentId);

  if (chunksError) return jsonError(chunksError.message, 500);

  const { error: documentError } = await supabase
    .from("course_documents")
    .delete()
    .eq("id", documentId);

  if (documentError) return jsonError(documentError.message, 500);

  return NextResponse.json({ success: true });
}

// PATCH /api/materials/[id] — renames a material
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return jsonError("Not authenticated.", 401);
  if (user.id !== ADMIN_USER_ID) return jsonError("Not authorised.", 403);

  const documentId = Number(id);
  if (isNaN(documentId)) return jsonError("Invalid material ID.");

  const body = await request.json();
  const newTitle = typeof body.title === "string" ? body.title.trim() : "";
  if (!newTitle) return jsonError("Title cannot be empty.");

  const { error: updateError } = await supabase
    .from("course_documents")
    .update({ title: newTitle })
    .eq("id", documentId);

  if (updateError) return jsonError(updateError.message, 500);

  return NextResponse.json({ success: true, title: newTitle });
}
