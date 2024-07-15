export const getHostname = (url: string) => {
  return new URL(url).hostname;
};

export const chunkContent = (content: string) => {
  // Assume 1 token ~= 4 characters
  // break each chunk into 3800 tokens
  // therefore, if the chunk is entirely text
  // the output will still be < 4k token cap
  const contentLength = content.length;
  const numChunks = Math.ceil(contentLength / 4 / 3800);
  const chunks = [];

  for (let i = 0; i < numChunks; i++) {
    const startIndex = i * 3800 * 4;
    const endIndex = Math.min((i + 1) * 3800 * 4, contentLength);
    const chunk = content.substring(startIndex, endIndex);
    chunks.push(chunk);
  }
  console.info(`Processed ${chunks.length} chunks:`);
  return chunks;
};

/**
 * Parse date string in "MM/DD/YYYY" format
 * @param dateStr
 * @returns Date object | null
 */
export const parseDateString = (dateStr: string): Date | null => {
  const [month, day, year] = dateStr.split("/").map(Number);

  // Check for invalid date parts
  if (!month || !day || !year) {
    return null;
  }

  return new Date(year, month - 1, day);
};
