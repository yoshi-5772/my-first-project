import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccessToken } from "@/lib/igToken";
import { publishToInstagram } from "@/lib/instagram";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const igUserId = process.env.IG_USER_ID;
  if (!igUserId) {
    console.error("[publish] IG_USER_ID is not set");
    return NextResponse.json({ stage: "publish", error: "server_misconfigured" }, { status: 500 });
  }

  const accessToken = await getCurrentAccessToken();
  if (!accessToken) {
    return NextResponse.json({ stage: "auth", error: "no_token" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl : null;
  const caption = typeof body?.caption === "string" ? body.caption : "";
  if (!imageUrl) {
    return NextResponse.json({ stage: "publish", error: "image_url_required" }, { status: 400 });
  }

  const result = await publishToInstagram(igUserId, accessToken, imageUrl, caption);
  if (!result.ok) {
    const status = result.stage === "auth" ? 401 : 502;
    return NextResponse.json({ stage: result.stage, error: result.error }, { status });
  }
  return NextResponse.json({ mediaId: result.mediaId, permalink: result.permalink });
}
