const HASHTAG_SEPARATOR = ".\n.\n.";

export function buildFinalText(captionJa: string, captionEn: string, hashtags: string[]): string {
  const captionParts = [captionJa.trim(), captionEn.trim()].filter(Boolean);
  const tagsText = hashtags.join(" ");
  const sections = [...captionParts];
  if (tagsText) {
    sections.push(HASHTAG_SEPARATOR, tagsText);
  }
  return sections.join("\n\n");
}
