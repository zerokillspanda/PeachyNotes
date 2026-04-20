import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LiveRecordForm from "./live-record-form";

type Course = {
  id: number;
  name: string;
};

type SearchParams = Promise<{
  editLectureId?: string;
}>;

export default async function LivePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const editLectureId = Number(params.editLectureId);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, name")
    .order("name", { ascending: true });

  let editableLecture:
    | { id: number; course_id: number | null; title: string }
    | null = null;

  if (editLectureId && !Number.isNaN(editLectureId)) {
    const { data } = await supabase
      .from("lectures")
      .select("id, course_id, title")
      .eq("id", editLectureId)
      .eq("user_id", user.id)
      .single();

    if (data) {
      editableLecture = data;
    }
  }

  return (
    <main className="app-page">
      <div className="mb-8">
        <h1 className="page-title">
          {editableLecture ? "Overwrite Lecture (Live Recording)" : "Live Lecture Notes"}
        </h1>
        <p className="page-subtitle">
          {editableLecture
            ? "Record new chunks and overwrite this lecture’s transcript and notes."
            : "Start one live lecture session. The app will record timed chunks, transcribe them, and keep updating one evolving lecture state."}
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load courses.
        </div>
      ) : (
        <LiveRecordForm
          courses={(courses ?? []) as Course[]}
          editLectureId={editableLecture?.id ?? null}
          initialCourseId={editableLecture?.course_id ?? null}
          initialTitle={editableLecture?.title ?? ""}
        />
      )}
    </main>
  );
}
