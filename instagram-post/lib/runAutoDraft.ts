import { generateCaption } from "@/lib/caption";
import { sendAutoDraftFailedEmail, sendDraftReadyEmail, sendPoolEmptyEmail } from "@/lib/email";
import { generateDraftToken, savePendingDraft, type PendingDraft } from "@/lib/pendingDraft";
import { pickRandomPoolItem } from "@/lib/pool";

export type AutoDraftResult = { ok: true; skipped: "pool_empty" } | { ok: true; token: string };

// プールから1枚選んでキャプションを自動生成し、下書きとして保存してメールを送る本体処理。
// 定期実行（/api/auto-draft）と手動テスト実行（/api/pool/test-draft）の両方から使う
export async function runAutoDraftOnce(origin: string): Promise<AutoDraftResult> {
  const picked = await pickRandomPoolItem();
  if (!picked) {
    await sendPoolEmptyEmail();
    return { ok: true, skipped: "pool_empty" };
  }

  const token = generateDraftToken();
  const reviewUrl = new URL(`/draft/${token}`, origin).toString();

  const draft: PendingDraft = {
    token,
    photoUrl: picked.photoUrl,
    keyword: picked.keyword,
    captionJa: "",
    captionEn: "",
    hashtags: [],
    status: "pending",
    permalink: null,
    createdAt: new Date().toISOString(),
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const generated = apiKey ? await tryGenerateCaption(apiKey, picked.photoUrl, picked.keyword) : null;

  if (generated) {
    draft.captionJa = generated.caption_ja;
    draft.captionEn = generated.caption_en;
    draft.hashtags = generated.hashtags;
    await savePendingDraft(draft);
    await sendDraftReadyEmail(reviewUrl, draft.captionJa);
  } else {
    await savePendingDraft(draft);
    await sendAutoDraftFailedEmail(reviewUrl);
  }

  return { ok: true, token };
}

async function tryGenerateCaption(apiKey: string, photoUrl: string, keyword: string) {
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = res.headers.get("content-type") || "image/jpeg";
    return await generateCaption(apiKey, base64, mediaType, keyword);
  } catch (err) {
    console.error("[auto-draft] caption generation failed", err);
    return null;
  }
}
