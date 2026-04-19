"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: number;
  name: string;
};

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

function toList(value: string[] | string | undefined) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export default function AudioUploadForm({ courses }: { courses: Course[] }) {
  const supabase = useMemo(() => createClient(), []);

  const [courseId, setCourseId] = useState(
    courses[0] ? String(courses[0].id) : ""
  );
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [storagePath, setStoragePath] = useState("");
  const [transcript, setTranscript] = useState("");

  const [notesResult, setNotesResult] = useState<NotesResult | null>(null);
  const [retrievedSources, setRetrievedSources] = useState<RetrievedSource[]>(
    []
  );

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingLecture, setIsSavingLecture] = useState(false);
  const [isSendingToNotion, setIsSendingToNotion] = useState(false);

  const [savedLectureId, setSavedLectureId] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [notionMessage, setNotionMessage] = useState("");

  async function handleUploadAndTranscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setNotesResult(null);
    setRetrievedSources([]);
    setSavedLectureId(null);
    setSaveMessage("");
    setNotionMessage("");

    if (!courseId) {
      setError("Please choose a course.");
      return;
    }

    if (!file) {
      setError("Please choose an audio file.");
      return;
    }

    setIsTranscribing(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in.");
      }

      const path = `${user.id}/${Date.now()}-${safeFileName(file.name)}`;

      setStatus("Uploading audio to Supabase Storage...");

      const { error: uploadError } = await supabase.storage
        .from("lecture-audio")
        .upload(path, file, {
          contentType: file.type || "audio/mpeg",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setStatus("Transcribing audio with Gemini...");

      const response = await fetch("/api/transcribe-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storagePath: path,
          mimeType: file.type || "audio/mpeg",
          originalFileName: file.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Transcription failed.");
      }

      setStoragePath(data.storagePath || "");
      setTranscript(data.transcript || "");
      setStatus(
        "Transcription complete. You can review and edit the transcript below."
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setStatus("");
    } finally {
      setIsTranscribing(false);
    }
  }

  async function handleGenerateNotes() {
    setError("");
    setStatus("");
    setSavedLectureId(null);
    setSaveMessage("");
    setNotionMessage("");

    if (!courseId) {
      setError("Please choose a course.");
      return;
    }

    if (!transcript.trim()) {
      setError("Transcript is empty.");
      return;
    }

    setIsGenerating(true);

    try {
      setStatus("Generating structured legal study notes...");

      const response = await fetch("/api/generate-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: Number(courseId),
          transcript: transcript.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Note generation failed.");
      }

      setNotesResult(data.result || null);
      setRetrievedSources(data.retrieved_sources || []);
      setStatus("Notes generated. You can save them in the app and send them to Notion.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setStatus("");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveLecture() {
    setError("");
    setSaveMessage("");

    if (!courseId) {
      setError("Please choose a course.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a lecture title.");
      return;
    }

    if (!transcript.trim()) {
      setError("Transcript is empty.");
      return;
    }

    if (!notesResult) {
      setError("Generate notes before saving the lecture.");
      return;
    }

    setIsSavingLecture(true);

    try {
      const response = await fetch("/api/audio-save-lecture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId: Number(courseId),
          title: title.trim(),
          transcript: transcript.trim(),
          storagePath,
          notesResult,
          retrievedSources,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save lecture.");
      }

      setSavedLectureId(data.lectureId ?? null);
      setSaveMessage("Lecture saved in your app.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setIsSavingLecture(false);
    }
  }

  async function handleSendToNotion() {
    setError("");
    setNotionMessage("");

    if (!notesResult) {
      setError("Generate notes before sending to Notion.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a lecture title before sending to Notion.");
      return;
    }

    setIsSendingToNotion(true);

    try {
      const response = await fetch("/api/notion/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          result: notesResult,
          lectureId: savedLectureId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not send notes to Notion."
        );
      }

      setNotionMessage("Notes sent to Notion successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
    } finally {
      setIsSendingToNotion(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleUploadAndTranscribe}
        className="rounded-xl border bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-semibold">1. Upload lecture audio</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Course</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Select a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Lecture title
            </label>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2"
              placeholder="Week 4 - Consideration and Estoppel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium">Audio file</label>
          <input
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.mpeg,.mpga"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-md border px-3 py-2"
          />
          <p className="mt-2 text-xs text-gray-500">
            First version: upload one file, transcribe it, then generate notes.
          </p>
        </div>

        <button
          type="submit"
          disabled={isTranscribing || courses.length === 0}
          className="mt-6 rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {isTranscribing ? "Uploading + transcribing..." : "Upload and transcribe"}
        </button>

        {status ? (
          <p className="mt-4 text-sm text-gray-700">{status}</p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {storagePath ? (
          <p className="mt-4 text-xs text-gray-500">Stored at: {storagePath}</p>
        ) : null}
      </form>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">2. Review transcript</h2>
        <p className="mt-2 text-sm text-gray-600">
          You can edit the transcript before generating the final study notes.
        </p>

        <textarea
          className="mt-4 min-h-[260px] w-full rounded-md border px-3 py-3 text-sm"
          placeholder="Transcript will appear here after transcription..."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />

        <button
          type="button"
          onClick={handleGenerateNotes}
          disabled={isGenerating || !transcript.trim()}
          className="mt-4 rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {isGenerating ? "Generating notes..." : "Generate notes from transcript"}
        </button>
      </div>

      {notesResult ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">3. Generated legal study notes</h2>

          <div className="mt-6">
            <h3 className="text-lg font-semibold">Lecture Summary</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
              {notesResult.lecture_summary || "No summary returned."}
            </p>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold">Key Topics</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-gray-800">
              {toList(notesResult.key_topics).map((item, index) => (
                <li key={`topic-${index}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold">Authorities Mentioned</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-gray-800">
              {toList(notesResult.authorities_mentioned).map((item, index) => (
                <li key={`authority-${index}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-lg font-semibold">
              From course notes: not clearly covered in class
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-gray-800">
              {toList(notesResult.supplement_bubble).map((item, index) => (
                <li key={`supplement-${index}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold">Used Sources</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-gray-800">
              {toList(notesResult.used_sources).map((item, index) => (
                <li key={`source-${index}`}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-8 rounded-lg border bg-gray-50 p-4">
            <h3 className="text-lg font-semibold">4. Save this lecture in your app</h3>
            <p className="mt-2 text-sm text-gray-600">
              This saves the lecture title, transcript, and generated notes into
              your existing lecture tables so later chunked updates can build on it.
            </p>

            <button
              type="button"
              onClick={handleSaveLecture}
              disabled={isSavingLecture || savedLectureId !== null}
              className="mt-4 rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {isSavingLecture
                ? "Saving lecture..."
                : savedLectureId
                ? "Lecture saved"
                : "Save lecture in app"}
            </button>

            {saveMessage ? (
              <p className="mt-3 text-sm text-green-700">{saveMessage}</p>
            ) : null}

            {savedLectureId ? (
              <p className="mt-2 text-sm text-gray-700">
                Saved as lecture #{savedLectureId}. View it on{" "}
                <Link href="/dashboard" className="underline">
                  Dashboard
                </Link>
                .
              </p>
            ) : null}
          </div>

          <div className="mt-6 rounded-lg border bg-gray-50 p-4">
            <h3 className="text-lg font-semibold">5. Send these notes to Notion</h3>
            <p className="mt-2 text-sm text-gray-600">
              This uses your existing Notion export flow. Make sure your parent
              page is already selected on the{" "}
              <Link href="/notion" className="underline">
                Notion settings page
              </Link>
              .
            </p>

            <button
              type="button"
              onClick={handleSendToNotion}
              disabled={isSendingToNotion || !notesResult}
              className="mt-4 rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {isSendingToNotion ? "Sending to Notion..." : "Send to Notion"}
            </button>

            {notionMessage ? (
              <p className="mt-3 text-sm text-green-700">{notionMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {retrievedSources.length > 0 ? (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Retrieved course-note chunks</h2>

          <div className="mt-4 space-y-4">
            {retrievedSources.map((source, index) => (
              <div key={index} className="rounded-lg border p-4">
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
        </div>
      ) : null}
    </div>
  );
}