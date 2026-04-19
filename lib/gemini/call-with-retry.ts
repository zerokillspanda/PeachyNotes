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

export async function callGeminiJsonWithRetry({
  url,
  body,
  maxAttempts = 5,
}: {
  url: string;
  body: unknown;
  maxAttempts?: number;
}) {
  let lastMessage = "Gemini request failed.";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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