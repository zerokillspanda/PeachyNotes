import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const execFileAsync = promisify(execFile);

const WHISPER_CPP_PATH =
  process.env.WHISPER_CPP_PATH ||
  path.join(os.homedir(), "whisper.cpp", "build", "bin", "whisper-cli");

const WHISPER_MODEL_PATH =
  process.env.WHISPER_MODEL_PATH ||
  path.join(os.homedir(), "whisper.cpp", "models", "ggml-base.en.bin");

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";

type CourseDocumentRow = { id: number; title: string };
type CourseChunkRow = {
  id: number;
  document_id: number;
  chunk_index: number;
  content: string;
  topic: string | null;
  citation: string | null;
};
type RetrievedSource = {
  title: string;
  topic: string | null;
  citation: string | null;
  content: string;
};
type NotesResult = {
  lecture_summary: string;
  key_topics: string[];
  authorities_mentioned: string[];
  supplement_bubble: string[];
  used_sources: string[];
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonSafely(response: Response) {
  try { return await response.json(); } catch { return null; }
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function buildKeywordFrequency(text: string) {
  const stopWords = new Set([
    "the","and","for","that","this","with","from","have","will","into","about",
    "there","their","they","them","then","than","were","been","being","which",
    "what","when","where","while","would","could","should","your","you","law",
    "legal","lecture","notes","class","course","student","students","just",
    "also","very","more","most","some","such","only","much","many","over",
    "under","onto","upon","between","through","after","before","because",
    "during","each","other","does","did","doing","done","has","had","having",
    "not","but","are","was","our","out","off","all","any","can","may","might",
    "say","says","said","get","got","getting","use","used","using","how","why",
    "who","whom","whose","his","her","hers","him","she","himself","herself",
    "its","it","itself","we","us","i","me","my","mine","to","of","in","on",
    "at","by","an","a","is","be","as","or","if",
  ]);
  const freq = new Map<string, number>();
  const words = normalizeText(text).split(" ");
  for (const word of words) {
    if (!word || word.length < 3 || stopWords.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  return freq;
}

function scoreChunk(chunkText: string, transcriptFrequency: Map<string, number>): number {
  const chunkWords = new Set(normalizeText(chunkText).split(" ").filter(Boolean));
  let score = 0;
  for (const [word, count] of transcriptFrequency.entries()) {
    if (chunkWords.has(word)) score += count;
  }
  return score;
}

function stripCodeFences(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return trimmed;
}

function extractTextFromGeminiResponse(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("\n").trim();
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value.split("\n").map((item) => item.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
  }
  return [];
}

function sanitizeNotesResult(value: any, retrievedSources: RetrievedSource[]): NotesResult {
  const fallbackUsedSources = retrievedSources.length > 0
    ? retrievedSources.map((s) => [s.title, s.topic ? `(${s.topic})` : ""].join(" ").trim())
    : [];
  return {
    lecture_summary: typeof value?.lecture_summary === "string" ? value.lecture_summary.trim() : "",
    key_topics: toStringArray(value?.key_topics),
    authorities_mentioned: toStringArray(value?.authorities_mentioned),
    supplement_bubble: toStringArray(value?.supplement_bubble),
    used_sources: toStringArray(value?.used_sources).length > 0
      ? toStringArray(value?.used_sources)
      : fallbackUsedSources,
  };
}

// Extract a properly shaped NotesResult from a raw state_json object
function extractNotesFromState(state: any): NotesResult {
  return {
    lecture_summary: typeof state?.lecture_summary === "string" ? state.lecture_summary : "",
    key_topics: toStringArray(state?.key_topics),
    authorities_mentioned: toStringArray(state?.authorities_mentioned),
    supplement_bubble: toStringArray(state?.supplement_bubble),
    used_sources: toStringArray(state?.used_sources),
  };
}

function isClearlyBogusTranscript(text: string) {
  const value = text.trim().toLowerCase();
  if (!value || value.length < 20) return true;
  const badPhrases = [
    "thanks for watching","thank you for watching","subtitles by","captions by",
    "please like and subscribe","see you in the next video","welcome back to the channel",
    "music playing","foreign",
  ];
  if (badPhrases.some((phrase) => value.includes(phrase))) return true;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length >= 8) {
    const uniqueRatio = new Set(words).size / words.length;
    if (uniqueRatio < 0.35) return true;
  }
  return false;
}

// Only regenerate notes on chunk 1, 4, 7, 10... to stay within rate limits
function shouldRegenerateNotes(chunkNumber: number) {
  return chunkNumber === 1 || chunkNumber % 3 === 1;
}

async function callGeminiWithRetry({ prompt, maxAttempts = 5 }: { prompt: string; maxAttempts?: number }) {
  if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY.");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  let lastMessage = "Gemini request failed.";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    const data = await readJsonSafely(response);
    if (response.ok) return data;
    lastMessage = data?.error?.message || `Gemini request failed with status ${response.status}.`;
    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt === maxAttempts) throw new Error(lastMessage);
    const retryAfterMs = response.headers.get("retry-after") ? Number(response.headers.get("retry-after")) * 1000 : 0;
    const delayMs = Math.max(retryAfterMs, Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 500));
    await sleep(delayMs);
  }
  throw new Error(lastMessage);
}

async function ensureLocalToolsExist() {
  try { await fs.access(WHISPER_CPP_PATH); } catch { throw new Error(`whisper-cli not found at ${WHISPER_CPP_PATH}`); }
  try { await fs.access(WHISPER_MODEL_PATH); } catch { throw new Error(`Whisper model not found at ${WHISPER_MODEL_PATH}`); }
}

async function transcribeAudioChunk(file: File) {
  await ensureLocalToolsExist();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "legal-live-"));
  const inputPath = path.join(tempDir, "input.webm");
  const wavPath = path.join(tempDir, "input.wav");
  const outputBasePath = path.join(tempDir, "transcript");
  try {
    await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
    await execFileAsync(FFMPEG_PATH, ["-y","-i",inputPath,"-ar","16000","-ac","1","-c:a","pcm_s16le",wavPath]);
    await execFileAsync(WHISPER_CPP_PATH, ["-m",WHISPER_MODEL_PATH,"-f",wavPath,"-otxt","-of",outputBasePath,"-nt","-np"]);
    return (await fs.readFile(`${outputBasePath}.txt`, "utf8")).trim();
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Local Whisper transcription failed.");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function POST(request: Request) {
  try {
    if (!GEMINI_API_KEY) return jsonError("Missing GEMINI_API_KEY.", 500);

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonError("Not authenticated.", 401);

    const formData = await request.formData();
    const fileEntry = formData.get("audio");
    const lectureId = Number(formData.get("lectureId"));
    const chunkNumber = Number(formData.get("chunkNumber"));

    if (!(fileEntry instanceof File)) return jsonError("Audio file is required.");
    if (fileEntry.size < 12000) return NextResponse.json({ skipped: true, reason: "tiny_chunk", transcript: "", notes: null });
    if (!lectureId || Number.isNaN(lectureId)) return jsonError("Missing or invalid lectureId.");
    if (!chunkNumber || Number.isNaN(chunkNumber)) return jsonError("Missing or invalid chunkNumber.");

    const { data: lecture, error: lectureError } = await supabase
      .from("lectures").select("id, user_id, course_id, title, notion_page_id")
      .eq("id", lectureId).eq("user_id", user.id).single();
    if (lectureError || !lecture) return jsonError("Lecture not found.", 404);
    if (!lecture.course_id) return jsonError("Lecture course is missing.", 400);

    const chunkTranscript = (await transcribeAudioChunk(fileEntry)).trim();
    if (isClearlyBogusTranscript(chunkTranscript)) {
      return NextResponse.json({ skipped: true, reason: "bogus_transcript", transcript: "", notes: null });
    }

    const { error: insertChunkError } = await supabase
      .from("lecture_chunks").insert({ lecture_id: lectureId, chunk_number: chunkNumber, transcript: chunkTranscript });
    if (insertChunkError) return jsonError(insertChunkError.message || "Could not save lecture chunk.", 500);

    const { data: allChunks, error: allChunksError } = await supabase
      .from("lecture_chunks").select("chunk_number, transcript")
      .eq("lecture_id", lectureId).order("chunk_number", { ascending: true });
    if (allChunksError) return jsonError(allChunksError.message, 500);

    const fullTranscript = (allChunks ?? [])
      .map((chunk) => chunk.transcript?.trim()).filter(Boolean).join("\n\n");

    // --- RATE LIMIT GUARD: skip Gemini on intermediate chunks ---
    // Return previous notes (properly shaped) without calling Gemini
    if (!shouldRegenerateNotes(chunkNumber)) {
      const { data: existingStateRow } = await supabase
        .from("lecture_state").select("state_json").eq("lecture_id", lectureId).single();

      const previousState = (existingStateRow?.state_json ?? {}) as any;

      // ✅ Fix: extract shaped NotesResult from state, not raw state object
      const previousNotes = extractNotesFromState(previousState);

      const nextState = {
        ...previousState,
        full_transcript: fullTranscript,
        latest_chunk_number: chunkNumber,
        saved_at: new Date().toISOString(),
      };

      await supabase.from("lecture_state").upsert(
        { lecture_id: lectureId, state_json: nextState, updated_at: new Date().toISOString() },
        { onConflict: "lecture_id" }
      );

      return NextResponse.json({
        success: true,
        lectureId,
        totalChunks: (allChunks ?? []).length,
        fullTranscript,
        transcript: chunkTranscript,
        notes: previousNotes,  // ✅ shaped correctly now
        result: previousNotes,
        retrieved_sources: previousState?.retrieved_sources ?? [],
        skipped: false,
        deferred_notes_regeneration: true,
      });
    }

    // --- Full Gemini regeneration on chunks 1, 4, 7, 10... ---
    const { data: documents } = await supabase
      .from("course_documents").select("id, title")
      .eq("course_id", lecture.course_id).order("created_at", { ascending: false });

    const typedDocuments = (documents ?? []) as CourseDocumentRow[];
    const documentIds = typedDocuments.map((doc) => doc.id);
    const documentTitleById = new Map<number, string>(typedDocuments.map((doc) => [doc.id, doc.title]));

    let retrievedSources: RetrievedSource[] = [];

    if (documentIds.length > 0) {
      const { data: chunks } = await supabase
        .from("course_chunks").select("id, document_id, chunk_index, content, topic, citation")
        .in("document_id", documentIds)
        .order("document_id", { ascending: true }).order("chunk_index", { ascending: true });

      const typedChunks = (chunks ?? []) as CourseChunkRow[];
      const transcriptFrequency = buildKeywordFrequency(fullTranscript);

      retrievedSources = typedChunks
        .map((chunk) => {
          const docTitle = documentTitleById.get(chunk.document_id) || "Course Material";
          return {
            chunk, title: docTitle,
            score: scoreChunk(`${docTitle} ${chunk.topic ?? ""} ${chunk.citation ?? ""} ${chunk.content}`, transcriptFrequency),
          };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((item) => ({ title: item.title, topic: item.chunk.topic, citation: item.chunk.citation, content: item.chunk.content }));
    }

    const retrievedContext = retrievedSources.length > 0
      ? retrievedSources.map((s, i) => `SOURCE ${i + 1}\nTitle: ${s.title}\nTopic: ${s.topic ?? "N/A"}\nCitation: ${s.citation ?? "N/A"}\nContent:\n${s.content}`).join("\n\n--------------------\n\n")
      : "No course-note chunks were retrieved.";

    const prompt = `
You are a legal lecture study assistant for law students.

This is an evolving lecture. You are given the full transcript collected so far.
Regenerate the current best full lecture notes for the entire lecture so far.

Return ONLY valid JSON with this exact shape:
{
  "lecture_summary": "string",
  "key_topics": ["string"],
  "authorities_mentioned": ["string"],
  "supplement_bubble": ["string"],
  "used_sources": ["string"]
}

Rules:
- lecture_summary: a clear structured summary of the lecture so far in normal prose.
- key_topics: the major legal topics actually covered so far.
- authorities_mentioned: only cases, statutes, constitutional provisions, regulations, legal tests, or named authorities actually mentioned in the transcript so far. If none, return [].
- supplement_bubble: relevant points from the retrieved course notes that add useful legal understanding but were not clearly covered so far.
- used_sources: short source labels based on the retrieved course-note materials you actually used.
- Do not include markdown.
- Do not include code fences.
- Do not include any text outside the JSON object.
- Be conservative and do not invent authorities or citations.

LECTURE TITLE:
${lecture.title}

FULL TRANSCRIPT SO FAR:
${fullTranscript}

RETRIEVED COURSE NOTE CHUNKS:
${retrievedContext}
    `.trim();

    const geminiData = await callGeminiWithRetry({ prompt });
    const rawText = extractTextFromGeminiResponse(geminiData);
    if (!rawText) return jsonError("Gemini returned an empty response.", 500);

    let parsed: any;
    try { parsed = JSON.parse(stripCodeFences(rawText)); }
    catch { return jsonError("Gemini returned invalid JSON.", 500); }

    const result = sanitizeNotesResult(parsed, retrievedSources);

    const { data: existingStateRow } = await supabase
      .from("lecture_state").select("state_json").eq("lecture_id", lectureId).single();
    const previousState = (existingStateRow?.state_json ?? {}) as any;

    const nextState = {
      ...previousState,
      source: "live_recording",
      lecture_id: lectureId,
      course_id: lecture.course_id,
      title: lecture.title,
      full_transcript: fullTranscript,
      lecture_summary: result.lecture_summary,
      key_topics: result.key_topics,
      authorities_mentioned: result.authorities_mentioned,
      supplement_bubble: result.supplement_bubble,
      used_sources: result.used_sources,
      retrieved_sources: retrievedSources,
      latest_chunk_number: chunkNumber,
      audio_chunk_storage_paths: Array.isArray(previousState?.audio_chunk_storage_paths)
        ? previousState.audio_chunk_storage_paths : [],
      saved_at: new Date().toISOString(),
    };

    const { error: upsertStateError } = await supabase
      .from("lecture_state").upsert(
        { lecture_id: lectureId, state_json: nextState, updated_at: new Date().toISOString() },
        { onConflict: "lecture_id" }
      );
    if (upsertStateError) return jsonError(upsertStateError.message || "Could not update lecture state.", 500);

    return NextResponse.json({
      success: true, lectureId,
      totalChunks: (allChunks ?? []).length,
      fullTranscript, transcript: chunkTranscript,
      notes: result, result, retrieved_sources: retrievedSources,
      skipped: false, deferred_notes_regeneration: false,
    });

  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Something went wrong.", 500);
  }
}
