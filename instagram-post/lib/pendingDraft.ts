import { randomBytes } from "crypto";
import { getJson, putJson } from "./blobStore";

export interface PendingDraft {
  token: string;
  photoUrl: string;
  keyword: string;
  captionJa: string;
  captionEn: string;
  hashtags: string[];
  status: "pending" | "published";
  permalink: string | null;
  createdAt: string;
}

const DRAFT_PREFIX = "auto-draft/";

function pathnameFor(token: string): string {
  return `${DRAFT_PREFIX}${token}.json`;
}

export function generateDraftToken(): string {
  return randomBytes(24).toString("hex");
}

export async function savePendingDraft(draft: PendingDraft): Promise<void> {
  await putJson(pathnameFor(draft.token), draft);
}

export async function getPendingDraft(token: string): Promise<PendingDraft | null> {
  return getJson<PendingDraft>(pathnameFor(token));
}
