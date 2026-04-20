"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "var(--pn-bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        {/* Brand mark */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 28 28" fill="none" aria-label="PeachyNotes">
              <circle cx="14" cy="14" r="13" fill="var(--pn-accent)" opacity="0.15" />
              <path
                d="M14 5C10.5 5 8 8 8 11.5C8 16 12 20 14 22C16 20 20 16 20 11.5C20 8 17.5 5 14 5Z"
                fill="var(--pn-accent)"
              />
              <path
                d="M14 5C14 5 16 7 16 9.5"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: "1.375rem",
                fontWeight: 600,
                color: "var(--pn-text)",
              }}
            >
              PeachyNotes
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--pn-text-muted)" }}>
            AI-powered lecture notes for NLSIU
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--pn-surface-2)",
            border: "1px solid var(--pn-border)",
            borderRadius: "var(--pn-radius-xl)",
            padding: "2rem",
            boxShadow: "var(--pn-shadow-lg)",
          }}
        >
          <h1
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: "1.375rem",
              fontWeight: 600,
              marginBottom: "1.5rem",
              color: "var(--pn-text)",
            }}
          >
            Sign in
          </h1>

          <form
            onSubmit={handleLogin}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  marginBottom: "0.375rem",
                  color: "var(--pn-text-muted)",
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@nlsiu.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pn-input"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  marginBottom: "0.375rem",
                  color: "var(--pn-text-muted)",
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pn-input"
                required
              />
            </div>

            <button
              type="submit"
              className="pn-btn-primary"
              disabled={loading}
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "0.65rem",
                marginTop: "0.25rem",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            {message && (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--pn-error)",
                  background: "var(--pn-error-bg)",
                  border: "1px solid var(--pn-error-border)",
                  borderRadius: "var(--pn-radius-md)",
                  padding: "0.625rem 0.875rem",
                }}
              >
                {message}
              </p>
            )}
          </form>
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: "1.25rem",
            fontSize: "0.875rem",
            color: "var(--pn-text-muted)",
          }}
        >
          Don&apos;t have an account?{" "}
          <Link href="/signup" style={{ color: "var(--pn-primary)", fontWeight: 500 }}>
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
