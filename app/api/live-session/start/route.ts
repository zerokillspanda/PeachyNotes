import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Not authenticated.", 401);
    }

    const body = await request.json();
    const courseId = Number(body?.courseId);
    const title =
      typeof body?.title === "string" ? body.title.trim() : "";

    if (!courseId || Number.isNaN(courseId)) {
      return jsonError("Missing or invalid courseId.");
    }

    if (!title) {
      return jsonError("Lecture title is required.");
    }

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
      return jsonError(
        lectureError?.message || "Could not create live lecture.",
        500
      );
    }

    const initialState = {
      source: "live_recording",
      lecture_id: lecture.id,
      course_id: courseId,
      title,
      full_transcript: "",
      lecture_summary: "",
      key_topics: [],
      authorities_mentioned: [],
      supplement_bubble: [],
      used_sources: [],
      retrieved_sources: [],
      latest_chunk_number: 0,
      audio_chunk_storage_paths: [],
      saved_at: new Date().toISOString(),
    };

    const { error: stateError } = await supabase
      .from("lecture_state")
      .insert({
        lecture_id: lecture.id,
        state_json: initialState,
        updated_at: new Date().toISOString(),
      });

    if (stateError) {
      await supabase
        .from("lectures")
        .delete()
        .eq("id", lecture.id)
        .eq("user_id", user.id);

      return jsonError(
        stateError.message || "Could not create initial lecture state.",
        500
      );
    }

    return NextResponse.json({
      success: true,
      lectureId: lecture.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    return jsonError(message, 500);
  }
}