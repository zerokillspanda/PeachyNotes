import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type NotesResult = {
  lecture_summary?: string;
  key_topics?: string[] | string;
  authorities_mentioned?: string[] | string;
  supplement_bubble?: string[] | string;
  used_sources?: string[] | string;
};

type RetrievedSource = {
  title?: string;
  topic?: string | null;
  citation?: string | null;
  content?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
}

export async function POST(request: Request) {
  const supabase = await createClient();

  let createdLectureId: number | null = null;
  let userId: string | null = null;

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Not authenticated.", 401);
    }

    userId = user.id;

    const body = await request.json();

    const courseId = Number(body?.courseId);
    const title =
      typeof body?.title === "string" ? body.title.trim() : "";
    const transcript =
      typeof body?.transcript === "string" ? body.transcript.trim() : "";
    const storagePath =
      typeof body?.storagePath === "string" ? body.storagePath : "";

    const notesResult = (body?.notesResult ?? {}) as NotesResult;
    const retrievedSources = Array.isArray(body?.retrievedSources)
      ? (body.retrievedSources as RetrievedSource[])
      : [];

    if (!courseId || Number.isNaN(courseId)) {
      return jsonError("Missing or invalid courseId.");
    }

    if (!title) {
      return jsonError("Lecture title is required.");
    }

    if (!transcript) {
      return jsonError("Transcript is required.");
    }

    const normalizedNotes = {
      lecture_summary:
        typeof notesResult.lecture_summary === "string"
          ? notesResult.lecture_summary.trim()
          : "",
      key_topics: toStringArray(notesResult.key_topics),
      authorities_mentioned: toStringArray(notesResult.authorities_mentioned),
      supplement_bubble: toStringArray(notesResult.supplement_bubble),
      used_sources: toStringArray(notesResult.used_sources),
    };

    const { data: lecture, error: lectureError } = await supabase
      .from("lectures")
      .insert({
        user_id: user.id,
        course_id: courseId,
        title,
      })
      .select("id")
      .single();

    if (lectureError || !lecture) {
      return jsonError(lectureError?.message || "Could not create lecture.", 500);
    }

    createdLectureId = lecture.id;

    const { error: chunkError } = await supabase
      .from("lecture_chunks")
      .insert({
        lecture_id: lecture.id,
        chunk_number: 1,
        transcript,
      });

    if (chunkError) {
      throw new Error(chunkError.message || "Could not save lecture transcript.");
    }

    const stateJson = {
      source: "audio_upload",
      lecture_id: lecture.id,
      course_id: courseId,
      title,
      audio_storage_path: storagePath || null,
      full_transcript: transcript,
      lecture_summary: normalizedNotes.lecture_summary,
      key_topics: normalizedNotes.key_topics,
      authorities_mentioned: normalizedNotes.authorities_mentioned,
      supplement_bubble: normalizedNotes.supplement_bubble,
      used_sources: normalizedNotes.used_sources,
      retrieved_sources: retrievedSources,
      saved_at: new Date().toISOString(),
    };

    const { error: stateError } = await supabase
      .from("lecture_state")
      .insert({
        lecture_id: lecture.id,
        state_json: stateJson,
        updated_at: new Date().toISOString(),
      });

    if (stateError) {
      throw new Error(stateError.message || "Could not save lecture state.");
    }

    return NextResponse.json({
      success: true,
      lectureId: lecture.id,
    });
  } catch (error) {
    if (createdLectureId && userId) {
      await supabase
        .from("lectures")
        .delete()
        .eq("id", createdLectureId)
        .eq("user_id", userId);
    }

    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    return jsonError(message, 500);
  }
}