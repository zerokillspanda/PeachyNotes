export function chunkText(text: string, maxChars = 1200, overlap = 200) {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + maxChars, cleaned.length);

    if (end < cleaned.length) {
      const lastBreak = cleaned.lastIndexOf("\n", end);
      const lastSentence = cleaned.lastIndexOf(". ", end);
      const splitAt = Math.max(lastBreak, lastSentence);

      if (splitAt > start + 300) {
        end = splitAt + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= cleaned.length) break;

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}