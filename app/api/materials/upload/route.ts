import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { createClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/materials/chunk-text";

const pdfParse = require("@cedrugs/pdf-parse");

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getFileExtension(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt")) return "txt";
  return "";
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError("Not authenticated.", 401);

    const { courseId, title: customTitle, storagePath, originalName } = await request.json();

    if (!courseId || isNaN(Number(courseId))) return jsonError("Missing or invalid courseId.");
    if (!storagePath) return jsonError("Missing storagePath.");

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("course-materials")
      .download(storagePath);

    if (downloadError || !fileData) {
      return jsonError(`Could not download file from storage: ${downloadError?.message}`, 500);
    }

    const bytes = Buffer.from(await fileData.arrayBuffer());
    const filename = originalName || storagePath.split("/").pop() || "file";
    const ext = getFileExtension(filename);

    let extractedText = "";

    if (ext === "pdf") {
      const result = await pdfParse(bytes);
      extractedText = normalizeExtractedText(result.text || "");
    } else if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer: bytes });
      extractedText = normalizeExtractedText(result.value || "");
    } else if (ext === "txt") {
      extractedText = normalizeExtractedText(bytes.toString("utf8"));
    } else {
      return jsonError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
    }

    if (!extractedText) return jsonError("Could not extract readable text from this file.");

    const title = customTitle || filename;
    const chunks = chunkText(extractedText, 1200, 200);

    if (chunks.length === 0) return jsonError("No usable text chunks were created from this file.");

    const { data: insertedDocument, error: documentError } = await supabase
      .from("course_documents")
      .insert({
        course_id: Number(courseId),
        title,
        source_type: "college_note",
        uploaded_by: user.id,
        full_text: extractedText,
      })
      .select("id")
      .single();

    if (documentError || !insertedDocument) {
      return jsonError(documentError?.message || "Could not save course document.", 500);
    }

    const rows = chunks.map((content, index) => ({
      document_id: insertedDocument.id,
      chunk_index: index,
      content,
      topic: null,
      citation: `${title} — chunk ${index + 1}`,
    }));

    const { error: chunkError } = await supabase.from("course_chunks").insert(rows);
    if (chunkError) return jsonError(chunkError.message || "Could not save course chunks.", 500);

    // Clean up storage file after processing
    await supabase.storage.from("course-materials").remove([storagePath]);

    return NextResponse.json({
      success: true,
      documentId: insertedDocument.id,
      title,
      extractedTextLength: extractedText.length,
      chunksCreated: rows.length,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return jsonError(message, 500);
  }
}
