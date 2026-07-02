// 離脱・再訪時に下書き（キーワード・編集済みキャプション）を復元するための最小限の永続化。
// 写真そのものは保存しない（撮り直せば済むうえ、容量的にlocalStorage向きではないため）

const DRAFT_KEY = "ig-post-draft-v1";

export interface DraftText {
  keyword: string;
  captionJa: string;
  captionEn: string;
  hashtags: string[];
}

export function loadDraft(): DraftText | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      typeof data.keyword === "string" &&
      typeof data.captionJa === "string" &&
      typeof data.captionEn === "string" &&
      Array.isArray(data.hashtags)
    ) {
      return data as DraftText;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveDraft(draft: DraftText): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DRAFT_KEY);
}
