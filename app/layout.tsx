import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PeachyNotes",
  description: "AI-powered legal lecture notes for NLSIU students",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var theme = localStorage.getItem('pn-theme');
                  if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        style={{
          display: "flex",
          minHeight: "100dvh",
          backgroundColor: "var(--pn-bg)",
          color: "var(--pn-text)",
        }}
      >
        <Sidebar />
        <main style={{ flex: 1, overflowY: "auto" }}>{children}</main>
      </body>
    </html>
  );
}

function Sidebar() {
  return (
    <aside
      className="hidden md:flex"
      style={{
        width: "var(--pn-sidebar)",
        flexShrink: 0,
        flexDirection: "column",
        borderRight: "1px solid var(--pn-border)",
        background: "var(--pn-surface)",
        padding: "1.25rem 0.75rem",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "0 0.5rem", marginBottom: "1.75rem" }}>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-label="PeachyNotes logo">
              <circle cx="14" cy="14" r="13" fill="var(--pn-accent)" opacity="0.15" />
              <path d="M14 5C10.5 5 8 8 8 11.5C8 16 12 20 14 22C16 20 20 16 20 11.5C20 8 17.5 5 14 5Z" fill="var(--pn-accent)" />
              <path d="M14 5C14 5 16 7 16 9.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--pn-text)",
                letterSpacing: "-0.01em",
              }}
            >
              PeachyNotes
            </span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "0.125rem", flex: 1 }}>
        <NavLink href="/dashboard" icon="⊞">Dashboard</NavLink>
        <NavLink href="/live" icon="●" liveIcon>Live Record</NavLink>
        <NavLink href="/audio" icon="🎙">Upload Audio</NavLink>
        <NavLink href="/materials" icon="📄">Materials</NavLink>
        <NavLink href="/generate" icon="✦">Generate Notes</NavLink>
        <NavLink href="/search" icon="⌕">Search</NavLink>
        <div style={{ margin: "0.75rem 0", borderTop: "1px solid var(--pn-divider)" }} />
        <NavLink href="/notion" icon="N">Notion Sync</NavLink>
      </nav>

      {/* Dark mode toggle */}
      <div style={{ marginTop: "1.5rem" }}>
        <ThemeToggleButton />
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  liveIcon,
  children,
}: {
  href: string;
  icon: string;
  liveIcon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="pn-nav-link">
      <span
        style={{
          fontSize: "0.85rem",
          width: "1.1rem",
          textAlign: "center",
          color: liveIcon ? "#dc2626" : undefined,
        }}
      >
        {icon}
      </span>
      {children}
    </Link>
  );
}

function ThemeToggleButton() {
  return (
    <button
      id="pn-theme-toggle"
      aria-label="Toggle dark mode"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        width: "100%",
        padding: "0.45rem 0.75rem",
        borderRadius: "var(--pn-radius-md)",
        background: "none",
        border: "1px solid var(--pn-border)",
        fontSize: "0.8125rem",
        color: "var(--pn-text-muted)",
        cursor: "pointer",
        transition: "background var(--pn-transition), border-color var(--pn-transition)",
      }}
      suppressHydrationWarning
      onClick={undefined}
    >
      <span style={{ fontSize: "0.9rem" }}>◑</span>
      <span>Toggle theme</span>
    </button>
  );
}
