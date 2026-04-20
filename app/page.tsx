import Link from 'next/link'

const highlights = [
  'Capture lecture context while you focus on listening, not typing.',
  'Generate complete notes with key points, definitions, and examples.',
  'Enrich each topic with insights from prior years\' notes and course commentaries.',
]

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-[#e9d9ca] bg-[color:color-mix(in_srgb,var(--paper)_95%,white)] p-8 shadow-[0_20px_60px_rgba(57,35,16,0.12)] sm:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[color:color-mix(in_srgb,var(--accent-peach)_45%,white)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[color:color-mix(in_srgb,var(--accent-lavender)_38%,white)] blur-3xl" />

        <div className="relative">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#eddccc] bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#81543b]">
            🍑 Smart lecture companion
          </p>

          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-[#2c1a10] sm:text-5xl">
            PeachyNotes
          </h1>

          <p className="mt-4 max-w-3xl text-pretty text-base leading-relaxed text-[#5e4a3c] sm:text-lg">
            PeachyNotes creates complete class notes for you while you sit in class and listen to the
            lecture, then adds extra context on the same topics from previous years&apos; notes and course
            commentaries.
          </p>

          <ul className="mt-8 grid gap-3 text-sm text-[#4f3b2f] sm:grid-cols-3 sm:text-base">
            {highlights.map((highlight) => (
              <li key={highlight} className="rounded-2xl border border-[#ecdccc] bg-white/75 px-4 py-4 shadow-sm">
                {highlight}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl bg-[#2f1a10] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#412519]"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-[#2f1a10]/20 bg-white/85 px-5 py-2.5 text-sm font-semibold text-[#2f1a10] transition hover:-translate-y-0.5 hover:bg-white"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
