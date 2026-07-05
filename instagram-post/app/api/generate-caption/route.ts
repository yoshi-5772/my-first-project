import { NextRequest, NextResponse } from "next/server";
import { generateCaption } from "@/lib/caption";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[caption] ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ stage: "caption", error: "server_misconfigured" }, { status: 500 });
  }

  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  const keyword = form?.get("keyword");
  if (!(photo instanceof Blob)) {
    return NextResponse.json({ stage: "caption", error: "photo_required" }, { status: 400 });
  }

  const arrayBuffer = await photo.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = photo.type || "image/jpeg";
  const keywordText = typeof keyword === "string" ? keyword.trim() : "";

  try {
    const result = await generateCaption(apiKey, base64, mediaType, keywordText);
    if (!result) {
      return NextResponse.json({ stage: "caption", error: "caption_failed" }, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[caption] request failed", err);
    return NextResponse.json({ stage: "caption", error: "caption_failed" }, { status: 502 });
  }
}
