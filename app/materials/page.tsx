"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AddMaterialForm from "./add-material-form";

const ADMIN_USER_ID = "7e49b324-6aae-4c84-9703-bd94822eef1a";

type Material = {
  id: number;
  title: string;
  created_at: string;
  course_id: number | null;
};

type Course = {
  id: number;
  name: string;
};

export default function MaterialsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id === ADMIN_USER_ID) setIsAdmin(true);

      const { data: coursesData, error: coursesError } = await supabase
        .from("courses")
        .select("id, name")
        .order("name", { ascending: true });

      const { data: materialsData, error: materialsError } = await supabase
        .from("course_documents")
        .select("id, title, created_at, course_id")
        .order("created_at", { ascending: false });

      if (coursesError || materialsError) {
        setLoadError(coursesError?.message || materialsError?.message || "Failed to load.");
      } else {
        setCourses(coursesData ?? []);
        setMaterials(materialsData ?? []);
      }
    }
    loadData();
  }, []);

  const courseMap = new Map(courses.map((c) => [c.id, c.name]));

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this material? This cannot be undone.")) return;
    setDeletingId(id);
    setDeleteError("");

    try {
      const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setDeleteError(data.error || "Delete failed.");
      } else {
        setMaterials((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      setDeleteError("Delete failed. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }


  function startRename(material: Material) {
    setRenamingId(material.id);
    setRenameValue(material.title);
    setRenameError("");
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
    setRenameError("");
  }

  async function submitRename(id: number) {
    if (!renameValue.trim()) {
      setRenameError("Title cannot be empty.");
      return;
    }
    setRenameLoading(true);
    setRenameError("");

    try {
      const res = await fetch(`/api/materials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setRenameError(data.error || "Rename failed.");
      } else {
        setMaterials((prev) =>
          prev.map((m) => (m.id === id ? { ...m, title: data.title } : m))
        );
        cancelRename();
      }
    } catch {
      setRenameError("Rename failed. Please try again.");
    } finally {
      setRenameLoading(false);
    }
  }


  return (
    <main className="app-page max-w-4xl">
      <div className="mb-6">
        <Link href="/dashboard" className="soft-link">
          ← Back to dashboard
        </Link>
      </div>

      <h1 className="page-title mb-2">Course Materials</h1>
      <p className="mb-6">Add your college notes here so the app can learn from them.</p>

      <div className="mb-10">
        <AddMaterialForm />
      </div>

      <h2 className="text-xl font-semibold mb-4">Saved Materials</h2>

      {loadError && <p className="text-red-600 mb-4">{loadError}</p>}
      {deleteError && <p className="text-red-600 mb-4">{deleteError}</p>}

      {materials.length === 0 ? (
        <p>No materials yet.</p>
      ) : (
        <div className="space-y-3">
          {materials.map((material) => (
            <div key={material.id} className="panel">
              {renamingId === material.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    autoFocus
                  />
                  {renameError && <p className="text-red-600 text-xs">{renameError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitRename(material.id)}
                      disabled={renameLoading}
                      className="rounded-md bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
                    >
                      {renameLoading ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelRename}
                      className="rounded-md border px-3 py-1 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-medium">{material.title}</p>
                  <p className="text-sm text-gray-600">
                    Course: {material.course_id ? courseMap.get(material.course_id) : "No course"}
                  </p>
                  <p className="text-sm text-gray-600">Material ID: {material.id}</p>
                  <p className="text-sm text-gray-600">
                    Created: {new Date(material.created_at).toLocaleString()}
                  </p>
                  {isAdmin && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => startRename(material)}
                        className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(material.id)}
                        disabled={deletingId === material.id}
                        className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === material.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
