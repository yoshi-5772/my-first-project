import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof Blob)) {
    return NextResponse.json({ stage: "upload", error: "photo_required" }, { status: 400 });
  }

  try {
    const filename = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const result = await put(filename, photo, {
      access: "public",
      contentType: "image/jpeg",
    });
    return NextResponse.json({ url: result.url });
  } catch (err) {
    console.error("[upload] blob put failed", err);
    return NextResponse.json({ stage: "upload", error: "upload_failed" }, { status: 502 });
  }
}
