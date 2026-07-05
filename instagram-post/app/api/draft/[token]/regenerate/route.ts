import { NextResponse } from "next/server";
import { generateCaption } from "@/lib/caption";
import { getPendingDraft, savePendingDraft } from "@/lib/pendingDraft";

export const maxDuration = 30;

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const draft = await getPendingDraft(token);
  if (!draft) {
    return NextResponse.json({ stage: "caption", error: "not_found" }, { status: 404 });
  }
  if (draft.status === "published") {
    return NextResponse.json({ stage: "caption", error: "already_published" }, { status: 409 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[draft-regenerate] ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ stage: "caption", error: "server_misconfigured" }, { status: 500 });
  }

  try {
    const photoRes = await fetch(draft.photoUrl);
    if (!photoRes.ok) {
      return NextResponse.json({ stage: "caption", error: "photo_fetch_failed" }, { status: 502 });
    }
    const arrayBuffer = await photoRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = photoRes.headers.get("content-type") || "image/jpeg";

    const result = await generateCaption(apiKey, base64, mediaType, draft.keyword);
    if (!result) {
      return NextResponse.json({ stage: "caption", error: "caption_failed" }, { status: 502 });
    }

    draft.captionJa = result.caption_ja;
    draft.captionEn = result.caption_en;
    draft.hashtags = result.hashtags;
    await savePendingDraft(draft);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[draft-regenerate] request failed", err);
    return NextResponse.json({ stage: "caption", error: "caption_failed" }, { status: 502 });
  }
}
