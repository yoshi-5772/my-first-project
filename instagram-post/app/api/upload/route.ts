import { NextRequest, NextResponse } from "next/server";
import { uploadPhoto } from "@/lib/photoUpload";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  if (!(photo instanceof Blob)) {
    return NextResponse.json({ stage: "upload", error: "photo_required" }, { status: 400 });
  }

  try {
    const url = await uploadPhoto(photo);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload] blob put failed", err);
    return NextResponse.json({ stage: "upload", error: "upload_failed" }, { status: 502 });
  }
}
