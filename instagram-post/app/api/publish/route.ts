import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccessToken } from "@/lib/igToken";

export const maxDuration = 60;

const GRAPH_VERSION = "v21.0";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

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

  try {
    const createRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
    });
    const createJson = await createRes.json();
    if (!createRes.ok || !createJson.id) {
      console.error("[publish] media create failed", createRes.status, createJson);
      if (isAuthError(createJson)) {
        return NextResponse.json({ stage: "auth", error: "ig_auth_error" }, { status: 401 });
      }
      return NextResponse.json({ stage: "publish", error: "media_create_failed" }, { status: 502 });
    }

    const creationId = createJson.id as string;
    const ready = await waitUntilReady(creationId, accessToken);
    if (!ready) {
      console.error("[publish] media not ready before timeout", creationId);
      return NextResponse.json({ stage: "publish", error: "media_not_ready" }, { status: 504 });
    }

    const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
    });
    const publishJson = await publishRes.json();
    if (!publishRes.ok || !publishJson.id) {
      console.error("[publish] media publish failed", publishRes.status, publishJson);
      if (isAuthError(publishJson)) {
        return NextResponse.json({ stage: "auth", error: "ig_auth_error" }, { status: 401 });
      }
      return NextResponse.json({ stage: "publish", error: "media_publish_failed" }, { status: 502 });
    }

    const permalink = await fetchPermalink(publishJson.id, accessToken);
    return NextResponse.json({ mediaId: publishJson.id, permalink });
  } catch (err) {
    console.error("[publish] request failed", err);
    return NextResponse.json({ stage: "publish", error: "request_failed" }, { status: 502 });
  }
}

async function waitUntilReady(creationId: string, accessToken: string): Promise<boolean> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${creationId}?fields=status_code&access_token=${accessToken}`,
    );
    const json = await res.json().catch(() => null);
    if (res.ok && json?.status_code === "FINISHED") return true;
    if (res.ok && json?.status_code === "ERROR") return false;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

async function fetchPermalink(mediaId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}?fields=permalink&access_token=${accessToken}`,
    );
    const json = await res.json().catch(() => null);
    return typeof json?.permalink === "string" ? json.permalink : null;
  } catch {
    return null;
  }
}

function isAuthError(json: unknown): boolean {
  const code = (json as { error?: { code?: number } })?.error?.code;
  // 190=無効なトークン、463/467=期限切れ 等、認証関連のエラーコード
  return code === 190 || code === 463 || code === 467;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
