import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

type CourseDocumentRow = {
  id: number;
  title: string;
};

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
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildKeywordFrequency(text: string) {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "that",
    "this",
    "with",
    "from",
    "have",
    "will",
    "into",
    "about",
    "there",
    "their",
    "they",
    "them",
    "then",
    "than",
    "were",
    "been",
    "being",
    "which",
    "what",
    "when",
    "where",
    "while",
    "would",
    "could",
    "should",
    "your",
    "you",
    "law",
    "legal",
    "lecture",
    "notes",
    "class",
    "course",
    "student",
    "students",
    "just",
    "also",
    "very",
    "more",
    "most",
    "some",
    "such",
    "only",
    "much",
    "many",
    "over",
    "under",
    "onto",
    "upon",
    "between",
    "through",
    "after",
    "before",
    "because",
    "being",
    "during",
    "each",
    "other",
    "than",
    "into",
    "does",
    "did",
    "doing",
    "done",
    "have",
    "has",
    "had",
    "having",
    "not",
    "but",
    "are",
    "was",
    "were",
    "our",
    "out",
    "off",
    "all",
    "any",
    "can",
    "may",
    "might",
    "say",
    "says",
    "said",
    "get",
    "got",
    "getting",
    "use",
    "used",
    "using",
    "how",
    "why",
    "who",
    "whom",
    "whose",
    "his",
    "her",
    "hers",
    "him",
    "she",
    "himself",
    "herself",
    "its",
    "it",
    "itself",
    "we",
    "us",
    "i",
    "me",
    "my",
    "mine",
    "to",
    "of",
    "in",
    "on",
    "at",
    "by",
    "an",
    "a",
    "is",
    "be",
    "as",
    "or",
    "if",
  ]);

  const freq = new Map<string, number>();
  const words = normalizeText(text).split(" ");

  for (const word of words) {
    if (!word) continue;
    if (word.length < 3) continue;
    if (stopWords.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  return freq;
}

function scoreChunk(
  chunkText: string,
  transcriptFrequency: Map<string, number>
): number {
  const normalizedChunk = normalizeText(chunkText);
  const chunkWords = new Set(normalizedChunk.split(" ").filter(Boolean));

  let score = 0;

  for (const [word, count] of transcriptFrequency.entries()) {
    if (chunkWords.has(word)) {
      score += count;
    }
  }

  return score;
}

function stripCodeFences(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return trimmed;
}

function extractTextFromGeminiResponse(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function sanitizeNotesResult(value: any, retrievedSources: RetrievedSource[]): NotesResult {
  const fallbackUsedSources =
    retrievedSources.length > 0
      ? retrievedSources.map((source) => {
          const parts = [source.title];
          if (source.topic) parts.push(`(${source.topic})`);
          return parts.join(" ");
        })
      : [];

  return {
    lecture_summary:
      typeof value?.lecture_summary === "string"
        ? value.lecture_summary.trim()
        : "",
    key_topics: toStringArray(value?.key_topics),
    authorities_mentioned: toStringArray(value?.authorities_mentioned),
    supplement_bubble: toStringArray(value?.supplement_bubble),
    used_sources:
      toStringArray(value?.used_sources).length > 0
        ? toStringArray(value?.used_sources)
        : fallbackUsedSources,
  };
}

async function callGeminiWithRetry({
  prompt,
  maxAttempts = 5,
}: {
  prompt: string;
  maxAttempts?: number;
}) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  let lastMessage = "Gemini request failed.";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await readJsonSafely(response);

    if (response.ok) {
      return data;
    }

    lastMessage =
      data?.error?.message ||
      `Gemini request failed with status ${response.status}.`;

    const shouldRetry = response.status === 429 || response.status >= 500;

    if (!shouldRetry || attempt === maxAttempts) {
      throw new Error(lastMessage);
    }

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : 0;

    const exponentialMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
    const jitterMs = Math.floor(Math.random() * 500);
    const delayMs = Math.max(retryAfterMs, exponentialMs + jitterMs);

    await sleep(delayMs);
  }

  throw new Error(lastMessage);
}

export async function POST(request: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return jsonError("Missing GEMINI_API_KEY.", 500);
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Not authenticated.", 401);
    }

    const body = await request.json();
    const courseId = Number(body?.courseId);
    const transcript =
      typeof body?.transcript === "string" ? body.transcript.trim() : "";

    if (!courseId || Number.isNaN(courseId)) {
      return jsonError("Missing or invalid courseId.");
    }

    if (!transcript) {
      return jsonError("Transcript is required.");
    }

    const { data: documents, error: documentsError } = await supabase
      .from("course_documents")
      .select("id, title")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    if (documentsError) {
      return jsonError(documentsError.message, 500);
    }

    const typedDocuments = (documents ?? []) as CourseDocumentRow[];
    const documentIds = typedDocuments.map((doc) => doc.id);

    const documentTitleById = new Map<number, string>();
    for (const doc of typedDocuments) {
      documentTitleById.set(doc.id, doc.title);
    }

    let retrievedSources: RetrievedSource[] = [];

    if (documentIds.length > 0) {
      const { data: chunks, error: chunksError } = await supabase
        .from("course_chunks")
        .select("id, document_id, chunk_index, content, topic, citation")
        .in("document_id", documentIds)
        .order("document_id", { ascending: true })
        .order("chunk_index", { ascending: true });

      if (chunksError) {
        return jsonError(chunksError.message, 500);
      }

      const typedChunks = (chunks ?? []) as CourseChunkRow[];
      const transcriptFrequency = buildKeywordFrequency(transcript);

      const scored = typedChunks
        .map((chunk) => {
          const title = documentTitleById.get(chunk.document_id) || "Course Material";
          const score = scoreChunk(
            `${title} ${chunk.topic ?? ""} ${chunk.citation ?? ""} ${chunk.content}`,
            transcriptFrequency
          );

          return {
            chunk,
            title,
            score,
          };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      retrievedSources = scored.map((item) => ({
        title: item.title,
        topic: item.chunk.topic,
        citation: item.chunk.citation,
        content: item.chunk.content,
      }));
    }

    const retrievedContext =
      retrievedSources.length > 0
        ? retrievedSources
            .map((source, index) => {
              return [
                `SOURCE ${index + 1}`,
                `Title: ${source.title}`,
                `Topic: ${source.topic ?? "N/A"}`,
                `Citation: ${source.citation ?? "N/A"}`,
                `Content:`,
                source.content,
              ].join("\n");
            })
            .join("\n\n--------------------\n\n")
        : "No course-note chunks were retrieved.";

    const prompt = `
You are a legal lecture study assistant for law students.

Your job:
1. Read the lecture transcript.
2. Read the retrieved course-note chunks.
3. Produce structured legal study notes.
4. Keep the main lecture notes focused on what was actually covered in class.
5. Then produce a supplement bubble containing only relevant points from the course notes that were not clearly covered in class.
6. Be accurate and conservative. Do not invent cases, statutes, principles, or citations.

Return ONLY valid JSON with this exact shape:
{
  "lecture_summary": "string",
  "key_topics": ["string"],
  "authorities_mentioned": ["string"],
  "supplement_bubble": ["string"],
  "used_sources": ["string"]
}

Rules:
- lecture_summary: a clear structured summary of the lecture in normal prose.
- key_topics: the major legal topics actually covered in the lecture.
- authorities_mentioned: only cases, statutes, constitutional provisions, regulations, legal tests, or named authorities actually mentioned in the transcript. If none, return [].
- supplement_bubble: relevant points from the retrieved course notes that add useful legal understanding but were not clearly covered in class.
- used_sources: short source labels based on the retrieved course-note materials you actually used.
- Do not include markdown.
- Do not include code fences.
- Do not include any text outside the JSON object.

LECTURE TRANSCRIPT:
${transcript}

RETRIEVED COURSE NOTE CHUNKS:
${retrievedContext}
    `.trim();

    const geminiData = await callGeminiWithRetry({ prompt });

    const rawText = extractTextFromGeminiResponse(geminiData);

    if (!rawText) {
      return jsonError("Gemini returned an empty response.", 500);
    }

    let parsed: any;

    try {
      parsed = JSON.parse(stripCodeFences(rawText));
    } catch {
      return jsonError("Gemini returned invalid JSON.", 500);
    }

    const result = sanitizeNotesResult(parsed, retrievedSources);

    return NextResponse.json({
      result,
      retrieved_sources: retrievedSources,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    return jsonError(message, 500);
  }
}