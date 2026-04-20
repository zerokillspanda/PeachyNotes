import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_USER_ID = "7e49b324-6aae-4c84-9703-bd94822eef1a";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function ensureAdminUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: jsonError("Not authenticated.", 401), user: null };
  }

  if (user.id !== ADMIN_USER_ID) {
    return { error: jsonError("Not authorised.", 403), user: null };
  }

  return { error: null, user };
}

// DELETE /api/materials/[id] — deletes a material and all its chunks
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documentId = Number(id);

    if (Number.isNaN(documentId)) return jsonError("Invalid material ID.");

    const { error: authError } = await ensureAdminUser();
    if (authError) return authError;

    const adminSupabase = createAdminClient();

    const { data: existingDoc, error: findError } = await adminSupabase
      .from("course_documents")
      .select("id")
      .eq("id", documentId)
      .maybeSingle();

    if (findError) return jsonError(findError.message, 500);
    if (!existingDoc) return jsonError("Material not found.", 404);

    const { error: chunksError } = await adminSupabase
      .from("course_chunks")
      .delete()
      .eq("document_id", documentId);

    if (chunksError) return jsonError(chunksError.message, 500);

    const { error: documentError } = await adminSupabase
      .from("course_documents")
      .delete()
      .eq("id", documentId);

    if (documentError) return jsonError(documentError.message, 500);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}

// PATCH /api/materials/[id] — renames a material
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documentId = Number(id);

    if (Number.isNaN(documentId)) return jsonError("Invalid material ID.");

    const { error: authError } = await ensureAdminUser();
    if (authError) return authError;

    const body = await request.json();
    const newTitle = typeof body.title === "string" ? body.title.trim() : "";
    if (!newTitle) return jsonError("Title cannot be empty.");

    const adminSupabase = createAdminClient();

    const { data: updatedDoc, error: updateError } = await adminSupabase
      .from("course_documents")
      .update({ title: newTitle })
      .eq("id", documentId)
      .select("id, title")
      .maybeSingle();

    if (updateError) return jsonError(updateError.message, 500);
    if (!updatedDoc) return jsonError("Material not found.", 404);

    return NextResponse.json({ success: true, title: updatedDoc.title });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
