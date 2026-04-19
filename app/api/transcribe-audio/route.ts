import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3-flash-preview";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function readJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
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

async function uploadFileToGemini(
  fileBytes: ArrayBuffer,
  mimeType: string,
  displayName: string
) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(fileBytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: {
          display_name: displayName,
        },
      }),
    }
  );

  if (!startResponse.ok) {
    const errorData = await readJsonSafely(startResponse);
    throw new Error(
      errorData?.error?.message || "Could not start Gemini file upload."
    );
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");

  if (!uploadUrl) {
    throw new Error("Gemini did not return an upload URL.");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(fileBytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: Buffer.from(fileBytes),
  });

  const uploadData = await readJsonSafely(uploadResponse);

  if (!uploadResponse.ok) {
    throw new Error(
      uploadData?.error?.message || "Could not upload audio bytes to Gemini."
    );
  }

  const fileUri = uploadData?.file?.uri;
  const fileName = uploadData?.file?.name;

  if (!fileUri || !fileName) {
    throw new Error("Gemini upload finished but file information was missing.");
  }

  return { fileUri, fileName };
}

async function transcribeWithGemini(fileUri: string, mimeType: string) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const prompt = [
    "Transcribe this law lecture audio into clean plain text.",
    "Return only the transcript.",
    "Do not add headings, summaries, bullet points, timestamps, speaker labels, or commentary.",
    "Preserve legal case names, statute names, and citations as accurately as possible.",
  ].join(" ");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                file_data: {
                  mime_type: mimeType,
                  file_uri: fileUri,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    }
  );

  const data = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini transcription failed.");
  }

  const transcript = extractTextFromGeminiResponse(data);

  if (!transcript) {
    throw new Error("Gemini returned an empty transcript.");
  }

  return transcript;
}

async function deleteGeminiFile(fileName: string) {
  if (!GEMINI_API_KEY || !fileName) {
    return;
  }

  await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${GEMINI_API_KEY}`,
    {
      method: "DELETE",
    }
  );
}

export async function POST(request: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return errorResponse("Missing GEMINI_API_KEY.", 500);
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Not authenticated.", 401);
    }

    const body = await request.json();
    const storagePath = String(body.storagePath || "");
    const originalFileName = String(body.originalFileName || "lecture-audio");
    const fallbackMimeType = String(body.mimeType || "audio/mpeg");

    if (!storagePath) {
      return errorResponse("Missing storagePath.");
    }

    if (!storagePath.startsWith(`${user.id}/`)) {
      return errorResponse("Invalid storage path.");
    }

    const { data: audioBlob, error: downloadError } = await supabase.storage
      .from("lecture-audio")
      .download(storagePath);

    if (downloadError || !audioBlob) {
      return errorResponse("Could not download the audio file from storage.", 500);
    }

    const fileBytes = await audioBlob.arrayBuffer();

    if (!fileBytes.byteLength) {
      return errorResponse("Uploaded audio file was empty.");
    }

    const mimeType = audioBlob.type || fallbackMimeType || "audio/mpeg";

    let geminiFileName = "";

    try {
      const { fileUri, fileName } = await uploadFileToGemini(
        fileBytes,
        mimeType,
        originalFileName
      );

      geminiFileName = fileName;

      const transcript = await transcribeWithGemini(fileUri, mimeType);

      return NextResponse.json({
        transcript,
        storagePath,
        mimeType,
      });
    } finally {
      if (geminiFileName) {
        await deleteGeminiFile(geminiFileName);
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return errorResponse(message, 500);
  }
}