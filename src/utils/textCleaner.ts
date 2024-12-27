export function cleanArticleText(text: string): string {
  return (
    text
      // Replace multiple newlines with a single newline
      .replace(/\n\s*\n/g, "\n")
      // Replace multiple spaces with a single space
      .replace(/\s+/g, " ")
      // Remove leading/trailing whitespace
      .trim()
      // Remove any zero-width spaces or other invisible characters
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      // Remove any HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Remove any remaining HTML tags
      .replace(/<[^>]*>/g, "")
      // Final trim to ensure clean result
      .trim()
  );
}
