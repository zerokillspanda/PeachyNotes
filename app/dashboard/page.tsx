import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";
import CreateLectureButton from "./create-lecture-button";

type SearchParams = Promise<{
  notion_connected?: string;
  notion_error?: string;
}>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id, name")
    .order("name", { ascending: true });

  const { data: lectures, error: lecturesError } = await supabase
    .from("lectures")
    .select("id, title, created_at, course_id")
    .order("created_at", { ascending: false });

  const { data: notionConnection } = await supabase
    .from("notion_connections")
    .select("workspace_name, workspace_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const courseMap = new Map(
    (courses ?? []).map((course) => [course.id, course.name])
  );

  const firstName = data.user.email?.split("@")[0] ?? "there";

  return (
    <div style={{ padding: "2rem 2.5rem", maxWidth: "860px" }}>
      {/* Page header */}
      <div style={{ marginBottom: "2rem" }}>
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--pn-text-faint)",
            marginBottom: "0.2rem",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
          }}
        >
          Welcome back
        </p>
        <h1
          style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: "clamp(1.5rem, 3vw, 2.1rem)",
            fontWeight: 600,
            color: "var(--pn-text)",
            lineHeight: 1.1,
          }}
        >
          {firstName}
        </h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--pn-text-muted)", marginTop: "0.2rem" }}>
          {data.user.email}
        </p>
      </div>

      {/* Status banners */}
      {params.notion_connected && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.75rem 1rem",
            borderRadius: "var(--pn-radius-md)",
            background: "var(--pn-success-bg)",
            border: "1px solid var(--pn-success-border)",
            color: "var(--pn-success)",
            fontSize: "0.875rem",
          }}
        >
          ✓ Notion connected successfully.
        </div>
      )}
      {params.notion_error && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.75rem 1rem",
            borderRadius: "var(--pn-radius-md)",
            background: "var(--pn-error-bg)",
            border: "1px solid var(--pn-error-border)",
            color: "var(--pn-error)",
            fontSize: "0.875rem",
          }}
        >
          Notion error: {params.notion_error}
        </div>
      )}

      {/* Quick actions */}
      <section style={{ marginBottom: "2rem" }}>
        <p className="pn-section-title">Quick actions</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
          <a href="/live" className="pn-tile">
            <span className="tile-icon" style={{ color: "#dc2626" }}>●</span>
            Live Record
          </a>
          <a href="/audio" className="pn-tile">
            <span className="tile-icon">🎙</span>
            Upload Audio
          </a>
          <a href="/materials" className="pn-tile">
            <span className="tile-icon">📄</span>
            Materials
          </a>
          <a href="/search" className="pn-tile">
            <span className="tile-icon">⌕</span>
            Search
          </a>
        </div>
      </section>

      {/* Notion + actions row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "1rem",
          alignItems: "start",
          marginBottom: "2rem",
        }}
      >
        <div className="pn-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--pn-text-muted)" }}>N</span>
            <h2 className="pn-section-title" style={{ margin: 0 }}>Notion</h2>
          </div>
          {notionConnection ? (
            <div style={{ fontSize: "0.875rem" }}>
              <p style={{ color: "var(--pn-success)", fontWeight: 500, marginBottom: "0.2rem" }}>
                ✓ Connected to{" "}
                <span style={{ color: "var(--pn-text)" }}>
                  {notionConnection.workspace_name || "Unnamed workspace"}
                </span>
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--pn-text-faint)" }}>
                ID: {notionConnection.workspace_id}
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: "0.875rem", color: "var(--pn-text-muted)", marginBottom: "0.875rem", lineHeight: 1.5 }}>
                Connect your Notion workspace to export lecture notes there.
              </p>
              <a href="/api/notion/connect" className="pn-btn-primary" style={{ textDecoration: "none" }}>
                Connect Notion
              </a>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "0.125rem" }}>
          <CreateLectureButton userId={data.user.id} courses={courses ?? []} />
          <LogoutButton />
        </div>
      </div>

      {/* Lectures list */}
      <section>
        <div
          style={{ display: "flex", alignItems: "baseline", gap: "0.625rem", marginBottom: "1rem" }}
        >
          <h2 className="pn-section-title" style={{ margin: 0 }}>Your Lectures</h2>
          {lectures && lectures.length > 0 && (
            <span className="pn-badge pn-badge-primary">{lectures.length}</span>
          )}
        </div>

        {coursesError && (
          <p style={{ color: "var(--pn-error)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
            {coursesError.message}
          </p>
        )}
        {lecturesError && (
          <p style={{ color: "var(--pn-error)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
            {lecturesError.message}
          </p>
        )}

        {!lectures || lectures.length === 0 ? (
          <div
            style={{
              padding: "3rem 2rem",
              textAlign: "center",
              background: "var(--pn-surface-2)",
              border: "1px dashed var(--pn-border)",
              borderRadius: "var(--pn-radius-lg)",
              color: "var(--pn-text-faint)",
              fontSize: "0.875rem",
            }}
          >
            <p style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>📓</p>
            <p style={{ fontWeight: 500, color: "var(--pn-text-muted)", marginBottom: "0.25rem" }}>
              No lectures yet
            </p>
            <p>Hit <strong>Live Record</strong> or <strong>Upload Audio</strong> to get started.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {lectures.map((lecture) => (
              <a
                key={lecture.id}
                href={`/lectures/${lecture.id}`}
                className="pn-lecture-item"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 500, color: "var(--pn-text)", marginBottom: "0.2rem" }}>
                      {lecture.title}
                    </p>
                    <p style={{ fontSize: "0.8125rem", color: "var(--pn-text-muted)" }}>
                      {lecture.course_id ? courseMap.get(lecture.course_id) : "No course"} ·{" "}
                      {new Date(lecture.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.8125rem", color: "var(--pn-primary)", flexShrink: 0 }}>
                    View →
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
