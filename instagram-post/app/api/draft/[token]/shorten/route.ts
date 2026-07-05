import { NextRequest, NextResponse } from "next/server";
import { shortenCaption } from "@/lib/caption";
import { getPendingDraft } from "@/lib/pendingDraft";

export const maxDuration = 30;

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const draft = await getPendingDraft(token);
  if (!draft) {
    return NextResponse.json({ stage: "caption", error: "not_found" }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[draft-shorten] ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ stage: "caption", error: "server_misconfigured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const captionJa = typeof body?.captionJa === "string" ? body.captionJa.trim() : "";
  const captionEn = typeof body?.captionEn === "string" ? body.captionEn.trim() : "";
  if (!captionJa || !captionEn) {
    return NextResponse.json({ stage: "caption", error: "caption_required" }, { status: 400 });
  }

  try {
    const result = await shortenCaption(apiKey, captionJa, captionEn);
    if (!result) {
      return NextResponse.json({ stage: "caption", error: "shorten_failed" }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[draft-shorten] request failed", err);
    return NextResponse.json({ stage: "caption", error: "shorten_failed" }, { status: 502 });
  }
}
