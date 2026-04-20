import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type LectureRow = {
  id: number;
  title: string;
  course_id: number | null;
  notion_page_id: string | null;
  created_at: string;
};

type CourseRow = {
  name: string;
};

type LectureChunkRow = {
  id: number;
  chunk_number: number;
  transcript: string | null;
  created_at: string;
};

type RetrievedSource = {
  title?: string;
  topic?: string | null;
  citation?: string | null;
  content?: string;
};

type LectureStateShape = {
  source?: string;
  title?: string;
  audio_storage_path?: string | null;
  full_transcript?: string;
  lecture_summary?: string;
  key_topics?: string[] | string;
  authorities_mentioned?: string[] | string;
  supplement_bubble?: string[] | string;
  used_sources?: string[] | string;
  retrieved_sources?: RetrievedSource[];
  saved_at?: string;
};

function toList(value: unknown): string[] {
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

function formatDate(value?: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function buildNotionUrl(notionPageId: string | null) {
  if (!notionPageId) return null;
  return `https://www.notion.so/${notionPageId.replace(/-/g, "")}`;
}

export default async function LectureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lectureId = Number(id);

  if (!lectureId || Number.isNaN(lectureId)) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: lecture, error: lectureError } = await supabase
    .from("lectures")
    .select("id, title, course_id, notion_page_id, created_at")
    .eq("id", lectureId)
    .eq("user_id", user.id)
    .single();

  if (lectureError || !lecture) {
    notFound();
  }

  const typedLecture = lecture as LectureRow;

  let courseName = "Unknown course";

  if (typedLecture.course_id) {
    const { data: course } = await supabase
      .from("courses")
      .select("name")
      .eq("id", typedLecture.course_id)
      .single();

    if (course) {
      courseName = (course as CourseRow).name;
    }
  }

  const { data: chunks } = await supabase
    .from("lecture_chunks")
    .select("id, chunk_number, transcript, created_at")
    .eq("lecture_id", typedLecture.id)
    .order("chunk_number", { ascending: true });

  const typedChunks = (chunks ?? []) as LectureChunkRow[];

  const { data: lectureStateRow } = await supabase
    .from("lecture_state")
    .select("state_json, updated_at")
    .eq("lecture_id", typedLecture.id)
    .single();

  const state = ((lectureStateRow?.state_json ?? {}) as LectureStateShape) || {};

  const lectureSummary =
    typeof state.lecture_summary === "string" ? state.lecture_summary : "";

  const keyTopics = toList(state.key_topics);
  const authorities = toList(state.authorities_mentioned);
  const supplementBubble = toList(state.supplement_bubble);
  const usedSources = toList(state.used_sources);
  const retrievedSources = Array.isArray(state.retrieved_sources)
    ? state.retrieved_sources
    : [];

  const transcriptFromChunks = typedChunks
    .map((chunk) => chunk.transcript?.trim())
    .filter(Boolean)
    .join("\n\n");

  const fullTranscript =
    typeof state.full_transcript === "string" && state.full_transcript.trim()
      ? state.full_transcript.trim()
      : transcriptFromChunks;

  const notionUrl = buildNotionUrl(typedLecture.notion_page_id);

  return (
    <main className="app-page">
      <div className="mb-8">
        <div className="mb-4 flex flex-wrap gap-3 text-sm text-gray-600">
          <Link href="/dashboard" className="soft-link">
            Dashboard
          </Link>
          <Link href="/audio" className="soft-link">
            Audio
          </Link>
          <Link href="/generate" className="soft-link">
            Generate
          </Link>
        </div>

        <h1 className="page-title">{typedLecture.title}</h1>
        <p className="page-subtitle">
          Detailed view of this saved lecture session.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel">
          <h2 className="text-lg font-semibold">Lecture Info</h2>
          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">Lecture ID:</span> {typedLecture.id}
            </p>
            <p>
              <span className="font-medium">Course:</span> {courseName}
            </p>
            <p>
              <span className="font-medium">Created:</span>{" "}
              {formatDate(typedLecture.created_at)}
            </p>
            <p>
              <span className="font-medium">Chunks saved:</span>{" "}
              {typedChunks.length}
            </p>
            <p>
              <span className="font-medium">Source:</span>{" "}
              {state.source || "manual/generate flow"}
            </p>
          </div>
        </div>

        <div className="panel">
          <h2 className="text-lg font-semibold">Notion Status</h2>
          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <p>
              <span className="font-medium">Saved Notion page ID:</span>{" "}
              {typedLecture.notion_page_id || "Not sent to Notion yet"}
            </p>

            {notionUrl ? (
              <p>
                <a
                  href={notionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="soft-link"
                >
                  Open Notion page
                </a>
              </p>
            ) : (
              <p className="text-gray-500">
                This lecture has not been linked to a Notion page yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="panel mt-8">
        <h2 className="text-xl font-semibold">Lecture Summary</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
          {lectureSummary || "No lecture summary saved yet."}
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="panel">
          <h2 className="text-xl font-semibold">Key Topics</h2>
          {keyTopics.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-6 text-sm text-gray-800">
              {keyTopics.map((item, index) => (
                <li key={`topic-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No key topics saved yet.</p>
          )}
        </div>

        <div className="panel">
          <h2 className="text-xl font-semibold">Authorities Mentioned</h2>
          {authorities.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-6 text-sm text-gray-800">
              {authorities.map((item, index) => (
                <li key={`authority-${index}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              No authorities saved yet.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-6 shadow-[0_8px_24px_rgba(36,25,15,0.08)]">
        <h2 className="text-xl font-semibold">
          From course notes: not clearly covered in class
        </h2>

        {supplementBubble.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-6 text-sm text-gray-800">
            {supplementBubble.map((item, index) => (
              <li key={`supplement-${index}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            No supplement bubble saved yet.
          </p>
        )}
      </div>

      <div className="panel mt-8">
        <h2 className="text-xl font-semibold">Used Sources</h2>
        {usedSources.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-6 text-sm text-gray-800">
            {usedSources.map((item, index) => (
              <li key={`used-source-${index}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-500">No used sources saved yet.</p>
        )}
      </div>

      <div className="panel mt-8">
        <h2 className="text-xl font-semibold">Full Transcript</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
          {fullTranscript || "No transcript saved yet."}
        </p>
      </div>

      <div className="panel mt-8">
        <h2 className="text-xl font-semibold">Saved Transcript Chunks</h2>

        {typedChunks.length > 0 ? (
          <div className="mt-4 space-y-4">
            {typedChunks.map((chunk) => (
              <div key={chunk.id} className="rounded-xl border border-[#e4d5c8] bg-[#fffdf9] p-4">
                <p className="text-sm font-semibold">
                  Chunk {chunk.chunk_number}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Saved: {formatDate(chunk.created_at)}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
                  {chunk.transcript || ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">No chunks saved yet.</p>
        )}
      </div>

      <div className="panel mt-8">
        <h2 className="text-xl font-semibold">Retrieved Course-Note Chunks</h2>

        {retrievedSources.length > 0 ? (
          <div className="mt-4 space-y-4">
            {retrievedSources.map((source, index) => (
              <div key={index} className="rounded-xl border border-[#e4d5c8] bg-[#fffdf9] p-4">
                <p className="text-sm font-semibold">
                  {source.title || `Source ${index + 1}`}
                </p>

                {source.topic ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Topic: {source.topic}
                  </p>
                ) : null}

                {source.citation ? (
                  <p className="mt-1 text-xs text-gray-500">
                    Citation: {source.citation}
                  </p>
                ) : null}

                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
                  {source.content || ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            No retrieved course-note chunks were saved for this lecture yet.
          </p>
        )}
      </div>
    </main>
  );
}