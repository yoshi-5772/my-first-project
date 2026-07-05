import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccessToken } from "@/lib/igToken";
import { publishToInstagram } from "@/lib/instagram";
import { getPendingDraft, savePendingDraft } from "@/lib/pendingDraft";
import { buildFinalText } from "@/lib/postText";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const draft = await getPendingDraft(token);
  if (!draft) {
    return NextResponse.json({ stage: "publish", error: "not_found" }, { status: 404 });
  }
  if (draft.status === "published") {
    return NextResponse.json({ stage: "publish", error: "already_published" }, { status: 409 });
  }

  const igUserId = process.env.IG_USER_ID;
  if (!igUserId) {
    console.error("[draft-publish] IG_USER_ID is not set");
    return NextResponse.json({ stage: "publish", error: "server_misconfigured" }, { status: 500 });
  }

  const accessToken = await getCurrentAccessToken();
  if (!accessToken) {
    return NextResponse.json({ stage: "auth", error: "no_token" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const captionJa = typeof body?.captionJa === "string" ? body.captionJa : draft.captionJa;
  const captionEn = typeof body?.captionEn === "string" ? body.captionEn : draft.captionEn;
  const hashtags = Array.isArray(body?.hashtags) ? body.hashtags : draft.hashtags;
  const caption = buildFinalText(captionJa, captionEn, hashtags);

  const result = await publishToInstagram(igUserId, accessToken, draft.photoUrl, caption);
  if (!result.ok) {
    const status = result.stage === "auth" ? 401 : 502;
    return NextResponse.json({ stage: result.stage, error: result.error }, { status });
  }

  draft.captionJa = captionJa;
  draft.captionEn = captionEn;
  draft.hashtags = hashtags;
  draft.status = "published";
  draft.permalink = result.permalink;
  await savePendingDraft(draft);

  return NextResponse.json({ mediaId: result.mediaId, permalink: result.permalink });
}
