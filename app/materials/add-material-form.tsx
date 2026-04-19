"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Course = {
  id: number;
  name: string;
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").replace(/_+/g, "_");
}

export default function AddMaterialForm() {
  const supabase = useMemo(() => createClient(), []);

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCourses() {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name")
        .order("name", { ascending: true });
      if (!error && data) setCourses(data);
    }
    loadCourses();
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!courseId) return setError("Please choose a course.");
    if (!file) return setError("Please choose a PDF or DOCX file.");

    setIsSubmitting(true);

    try {
      const safeName = sanitizeFilename(file.name);
      const storagePath = `materials/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("course-materials")
        .upload(storagePath, file, { upsert: false });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const response = await fetch("/api/materials/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          title: title.trim(),
          storagePath,
          originalName: file.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Processing failed.");

      setMessage(`Uploaded "${data.title}" successfully. Created ${data.chunksCreated} chunks.`);
      setTitle("");
      setFile(null);
      const fileInput = document.getElementById("materials-file-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border p-6">
      <div>
        <h2 className="text-xl font-semibold">Add shared course material</h2>
        <p className="mt-1 text-sm text-gray-600">
          Upload a PDF or DOCX file and store it as part of the shared RAG base for this course.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Course</label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        >
          <option value="">Select a course</option>
          {courses.map((course) => (
            <option key={course.id} value={String(course.id)}>
              {course.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Optional title override</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Leave blank to use the file name"
          className="w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">File</label>
        <input
          id="materials-file-input"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-md border px-3 py-2"
        />
        <p className="mt-2 text-xs text-gray-500">Supported: PDF, DOCX, TXT</p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? "Uploading..." : "Upload material"}
      </button>

      {message && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </form>
  );
}
