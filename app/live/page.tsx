import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LiveRecordForm from "./live-record-form";

type Course = {
  id: number;
  name: string;
};

export default async function LivePage() {
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
        <h1 className="page-title">Live Lecture Notes</h1>
        <p className="page-subtitle">
          Start one live lecture session. The app will record timed chunks,
          transcribe them, and keep updating one evolving lecture state.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load courses.
        </div>
      ) : (
        <LiveRecordForm courses={(courses ?? []) as Course[]} />
      )}
    </main>
  );
}