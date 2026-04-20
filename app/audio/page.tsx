import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AudioUploadForm from "./audio-upload-form";

type Course = {
  id: number;
  name: string;
};

export default async function AudioPage() {
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

  return (
    <main className="app-page">
      <div className="mb-8">
        <h1 className="page-title">Audio Upload + Transcription</h1>
        <p className="page-subtitle">
          Upload one lecture audio file, transcribe it, then run your existing
          legal notes generator on the transcript.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load courses.
        </div>
      ) : (
        <AudioUploadForm courses={(courses ?? []) as Course[]} />
      )}
    </main>
  );
}