"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

function getSupportedAudioMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "";
}

function guessExtensionFromMimeType(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("webm")) return "webm";
  return "webm";
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function RecordForm({ courses }: { courses: Course[] }) {
  const supabase = useMemo(() => createClient(), []);

  const [courseId, setCourseId] = useState(
    courses[0] ? String(courses[0].id) : ""
  );
  const [title, setTitle] = useState("");

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingLecture, setIsSavingLecture] = useState(false);
  const [isSendingToNotion, setIsSendingToNotion] = useState(false);

  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState("");
  const [recordedAudioUrl, setRecordedAudioUrl] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [storagePath, setStoragePath] = useState("");
  const [transcript, setTranscript] = useState("");
  const [notesResult, setNotesResult] = useState<NotesResult | null>(null);
  const [retrievedSources, setRetrievedSources] = useState<RetrievedSource[]>(
    []
  );

  const [savedLectureId, setSavedLectureId] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [notionMessage, setNotionMessage] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }

      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [recordedAudioUrl]);

  function resetMessagesForNewRun() {
    setError("");
    setStatus("");
    setNotesResult(null);
    setRetrievedSources([]);
    setSavedLectureId(null);
    setSaveMessage("");
    setNotionMessage("");
    setStoragePath("");
    setTranscript("");
  }

  async function startRecording() {
    resetMessagesForNewRun();

    if (!courseId) {
      setError("Please choose a course.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a lecture title.");
      return;
    }

    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setError("This browser does not support microphone recording.");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setError("This browser does not support MediaRecorder.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];

      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      setRecordedMimeType(recorder.mimeType || mimeType || "");

      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
        setRecordedAudioUrl("");
      }

      setRecordedBlob(null);
      setRecordingSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalMimeType =
          recorder.mimeType || mimeType || "audio/webm";

        const blob = new Blob(recordedChunksRef.current, {
          type: finalMimeType,
        });

        const blobUrl = URL.createObjectURL(blob);

        setRecordedBlob(blob);
        setRecordedMimeType(finalMimeType);
        setRecordedAudioUrl(blobUrl);
        setStatus("Recording stopped. Review the audio, then upload and transcribe it.");

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      recorder.start();

      setIsRecording(true);
      setStatus("Recording in progress...");

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not start recording.";
      setError(message);
      setStatus("");
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) {
      return;
    }

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  }

  async function handleUploadAndTranscribeRecording() {
    setError("");
    setStatus("");
    setNotesResult(null);
    setRetrievedSources([]);
    setSavedLectureId(null);
    setSaveMessage("");
    setNotionMessage("");

    if (!recordedBlob) {
      setError("Please record audio first.");
      return;
    }

    setIsUploadingRecording(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("You must be logged in.");
      }

      const extension = guessExtensionFromMimeType(
        recordedMimeType || recordedBlob.type || "audio/webm"
      );

      const fileName = safeFileName(`${title.trim() || "recorded-lecture"}.${extension}`);
      const path = `${user.id}/${Date.now()}-${fileName}`;

      const uploadFile = new File([recordedBlob], fileName, {
        type: recordedMimeType || recordedBlob.type || "audio/webm",
      });

      setStatus("Uploading recorded audio to Supabase Storage...");

      const { error: uploadError } = await supabase.storage
        .from("lecture-audio")
        .upload(path, uploadFile, {
          contentType: uploadFile.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setStatus("Transcribing recorded audio with Gemini...");

      const response = await fetch("/api/transcribe-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storagePath: path,
          mimeType: uploadFile.type,
          originalFileName: fileName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Transcription failed.");
      }

      setStoragePath(data.storagePath || "");
      setTranscript(data.transcript || "");
      setStatus("Transcription complete. Review the transcript below, then generate notes.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setStatus("");
    } finally {
      setIsUploadingRecording(false);
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
      setStatus("Notes generated. Save this lecture in your app and optionally send it to Notion.");
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
        throw new Error(data.error || "Could not send notes to Notion.");
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
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">1. Record lecture audio</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Course</label>
            <select
              className="w-full rounded-md border px-3 py-2"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={isRecording}
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
              placeholder="Week 5 - Mens Rea and Strict Liability"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isRecording}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startRecording}
            disabled={isRecording}
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            Start recording
          </button>

          <button
            type="button"
            onClick={stopRecording}
            disabled={!isRecording}
            className="rounded-md border px-4 py-2 disabled:opacity-50"
          >
            Stop recording
          </button>

          <span className="text-sm text-gray-700">
            {isRecording
              ? `Recording... ${formatDuration(recordingSeconds)}`
              : `Current length: ${formatDuration(recordingSeconds)}`}
          </span>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Microphone access requires permission and works on localhost or HTTPS.
        </p>

        {recordedAudioUrl ? (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">Recorded audio preview</p>
            <audio controls src={recordedAudioUrl} className="w-full" />
          </div>
        ) : null}

        <div className="mt-6">
          <button
            type="button"
            onClick={handleUploadAndTranscribeRecording}
            disabled={!recordedBlob || isUploadingRecording || isRecording}
            className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {isUploadingRecording
              ? "Uploading + transcribing..."
              : "Upload recording and transcribe"}
          </button>
        </div>

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
      </div>

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
                Saved as lecture #{savedLectureId}. Open the{" "}
                <Link href={`/lectures/${savedLectureId}`} className="underline">
                  lecture page
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