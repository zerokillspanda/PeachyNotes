"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: number;
  name: string;
};

type LiveNotes = {
  lecture_summary?: string;
  key_topics?: string[];
  authorities_mentioned?: string[];
  supplement_bubble?: string[];
  used_sources?: string[];
  retrieved_sources?: Array<{
    content?: string;
    title?: string;
    citation?: string;
    topic?: string;
  }>;
};

const CHUNK_MS = 12000;
const MIN_BLOB_BYTES = 12000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSupportedMimeType() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const option of options) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(option)) {
      return option;
    }
  }
  return "";
}

export default function LiveRecordForm({
  courses: initialCourses = [],
  editLectureId = null,
  initialCourseId = null,
  initialTitle = "",
}: {
  courses?: Course[];
  editLectureId?: number | null;
  initialCourseId?: number | null;
  initialTitle?: string;
}) {
  const supabase = createClient();

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [courseId, setCourseId] = useState(initialCourseId ? String(initialCourseId) : "");
  const [title, setTitle] = useState(initialTitle);

  const [isStarting, setIsStarting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const [lectureId, setLectureId] = useState<number | null>(null);
  const [chunkNumber, setChunkNumber] = useState(0);

  const [status, setStatus] = useState("Idle");
  const [latestTranscript, setLatestTranscript] = useState("");
  const [fullTranscript, setFullTranscript] = useState("");
  const [notes, setNotes] = useState<LiveNotes | null>(null);
  const [error, setError] = useState("");

  const [isSavingToNotion, setIsSavingToNotion] = useState(false);
  const [notionPageUrl, setNotionPageUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const stopRequestedRef = useRef(false);
  const lectureIdRef = useRef<number | null>(null);
  const chunkNumberRef = useRef(0);
  const processingRef = useRef(false);

  async function startLiveSession() {
    setError("");
    if (!courseId) { setError("Please choose a course."); return; }
    if (!title.trim()) { setError("Please enter a lecture title."); return; }

    setIsStarting(true);
    setStatus("Starting live session...");

    try {
      const startRes = await fetch("/api/live-session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: Number(courseId),
          title: title.trim(),
          lectureId: editLectureId,
        }),
      });

      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "Failed to start live session.");

      const newLectureId = startData.lectureId;
      if (!newLectureId) throw new Error("Live lecture session is missing.");

      setLectureId(newLectureId);
      lectureIdRef.current = newLectureId;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stopRequestedRef.current = false;
      chunkNumberRef.current = 0;
      setNotionPageUrl(null);

      setIsRecording(true);
      setStatus("Recording live chunks...");
      runRecordingLoop(stream);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start live session.";
      setError(message);
      setStatus("Idle");
    } finally {
      setIsStarting(false);
    }
  }

  async function stopLiveSession() {
    setIsStopping(true);
    setStatus("Stopping after current chunk...");
    stopRequestedRef.current = true;

    while (processingRef.current) {
      await sleep(250);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsStopping(false);
    setStatus("Stopped");
  }

  async function saveToNotion() {
    if (!lectureId || !notes) return;
    setIsSavingToNotion(true);
    setError("");
    try {
      const res = await fetch("/api/notion/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lectureId,
          title: title.trim() || "Untitled Lecture Notes",
          result: notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save to Notion.");
      setNotionPageUrl(data.notionPageUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save to Notion.");
    } finally {
      setIsSavingToNotion(false);
    }
  }

  async function runRecordingLoop(stream: MediaStream) {
    const mimeType = getSupportedMimeType();

    while (!stopRequestedRef.current) {
      try {
        const blob = await recordSingleChunk(stream, mimeType);

        if (stopRequestedRef.current && blob.size < MIN_BLOB_BYTES) break;
        if (blob.size < MIN_BLOB_BYTES) { setStatus("Skipped tiny chunk..."); continue; }

        const currentLectureId = lectureIdRef.current;
        if (!currentLectureId) throw new Error("Live lecture session is missing.");

        chunkNumberRef.current += 1;
        const currentChunkNumber = chunkNumberRef.current;
        setChunkNumber(currentChunkNumber);

        processingRef.current = true;
        setStatus(`Processing chunk ${currentChunkNumber}...`);

        const result = await sendChunkForProcessing(blob, currentLectureId, currentChunkNumber);

        if (result.skipped) {
          setStatus(`Skipped chunk ${currentChunkNumber} (${result.reason || "bad transcript"})`);
        } else {
          if (result.transcript) setLatestTranscript(result.transcript);
          if (result.fullTranscript) setFullTranscript(result.fullTranscript);
          if (result.notes) setNotes(result.notes);
          setStatus(`Processed chunk ${currentChunkNumber}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Chunk processing failed.";
        setError(message);
        setStatus("Error during live processing");
      } finally {
        processingRef.current = false;
      }

      await sleep(300);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setStatus("Stopped");
  }

  function recordSingleChunk(stream: MediaStream, mimeType: string) {
    return new Promise<Blob>((resolve, reject) => {
      try {
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        const parts: BlobPart[] = [];
        let finished = false;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) parts.push(event.data);
        };

        recorder.onerror = () => {
          if (!finished) { finished = true; reject(new Error("MediaRecorder error.")); }
        };

        recorder.onstop = () => {
          if (!finished) {
            finished = true;
            resolve(new Blob(parts, { type: mimeType || "audio/webm" }));
          }
        };

        recorder.start();
        window.setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, CHUNK_MS);
      } catch {
        reject(new Error("Could not record audio chunk."));
      }
    });
  }

  async function sendChunkForProcessing(
    blob: Blob,
    liveLectureId: number,
    currentChunkNumber: number
  ) {
    const formData = new FormData();
    formData.append(
      "audio",
      new File([blob], `chunk-${currentChunkNumber}.webm`, {
        type: blob.type || "audio/webm",
      })
    );
    formData.append("lectureId", String(liveLectureId));
    formData.append("chunkNumber", String(currentChunkNumber));

    const res = await fetch("/api/live-session/process-chunk", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to process live chunk.");
    return data;
  }

  return (
    <div className="space-y-6 rounded-2xl border p-6">
      {editLectureId ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          You are editing lecture #{editLectureId}. Starting a session will replace its existing chunks and notes.
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Course</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            disabled={isRecording || isStarting}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">Select a course</option>
            {courses.map((course) => (
              <option key={course.id} value={String(course.id)}>{course.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Lecture title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isRecording || isStarting}
            placeholder="e.g. Consideration and promissory estoppel"
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={startLiveSession}
            disabled={isRecording || isStarting}
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {isStarting
              ? "Starting..."
              : editLectureId
              ? "Start overwrite recording"
              : "Start live lecture"}
          </button>

          <button
            type="button"
            onClick={stopLiveSession}
            disabled={!isRecording || isStopping}
            className="rounded-md border px-4 py-2 disabled:opacity-50"
          >
            {isStopping ? "Stopping..." : "Stop"}
          </button>

          {lectureId && !isRecording && notes && (
            <button
              type="button"
              onClick={saveToNotion}
              disabled={isSavingToNotion}
              className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {isSavingToNotion
                ? "Saving to Notion..."
                : notionPageUrl
                ? "Saved! Save again"
                : "Save to Notion"}
            </button>
          )}
        </div>

        {notionPageUrl && (
          <a
            href={notionPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-indigo-600 underline"
          >
            Open in Notion →
          </a>
        )}

        <div className="rounded-md bg-gray-50 p-3 text-sm">
          <p><strong>Status:</strong> {status}</p>
          <p><strong>Lecture ID:</strong> {lectureId ?? "-"}</p>
          <p><strong>Processed chunks:</strong> {chunkNumber}</p>
        </div>

        {error ? (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border p-4">
          <h2 className="mb-2 text-lg font-semibold">Latest transcript chunk</h2>
          <p className="whitespace-pre-wrap text-sm">
            {latestTranscript || "No processed chunk yet."}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="mb-2 text-lg font-semibold">Running transcript</h2>
          <p className="whitespace-pre-wrap text-sm">
            {fullTranscript || "Transcript will build here as chunks are processed."}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Current evolving notes</h2>

          {notes ? (
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold">Lecture summary</h3>
                <p className="whitespace-pre-wrap">{notes.lecture_summary || "—"}</p>
              </div>

              <div>
                <h3 className="font-semibold">Key topics</h3>
                {notes.key_topics && notes.key_topics.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {notes.key_topics.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                ) : <p>—</p>}
              </div>

              <div>
                <h3 className="font-semibold">Authorities mentioned</h3>
                {notes.authorities_mentioned && notes.authorities_mentioned.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {notes.authorities_mentioned.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                ) : <p>—</p>}
              </div>

              <div className="rounded-md bg-yellow-50 p-3">
                <h3 className="font-semibold">From course notes: not clearly covered in class</h3>
                {notes.supplement_bubble && notes.supplement_bubble.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {notes.supplement_bubble.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                ) : <p>—</p>}
              </div>

              <div>
                <h3 className="font-semibold">Used sources</h3>
                {notes.used_sources && notes.used_sources.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {notes.used_sources.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                ) : <p>—</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm">Notes will appear as chunks are processed.</p>
          )}
        </div>
      </div>
    </div>
  );
}
