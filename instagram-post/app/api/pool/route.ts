import { NextRequest, NextResponse } from "next/server";
import { addPoolItem, listPoolItems } from "@/lib/pool";
import { uploadPhoto } from "@/lib/photoUpload";

export const maxDuration = 30;

export async function GET() {
  try {
    const items = await listPoolItems();
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[pool] list failed", err);
    return NextResponse.json({ error: "list_failed" }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  const keyword = form?.get("keyword");
  if (!(photo instanceof Blob)) {
    return NextResponse.json({ error: "photo_required" }, { status: 400 });
  }
  const keywordText = typeof keyword === "string" ? keyword.trim() : "";

  try {
    const url = await uploadPhoto(photo);
    const item = await addPoolItem(url, keywordText);
    return NextResponse.json({ item });
  } catch (err) {
    console.error("[pool] add failed", err);
    return NextResponse.json({ error: "add_failed" }, { status: 502 });
  }
}
