// Instagram Graph APIへのmedia作成→ポーリング→publishの本体ロジック。
// 手動投稿（/api/publish）と自動下書きからの投稿承認（/api/draft/[token]/publish）の
// 両方から使う

const GRAPH_VERSION = "v21.0";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30000;

export type PublishOutcome =
  | { ok: true; mediaId: string; permalink: string | null }
  | { ok: false; stage: "auth" | "publish"; error: string };

export async function publishToInstagram(
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  caption: string,
): Promise<PublishOutcome> {
  try {
    const createRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
    });
    const createJson = await createRes.json();
    if (!createRes.ok || !createJson.id) {
      console.error("[instagram] media create failed", createRes.status, createJson);
      if (isAuthError(createJson)) return { ok: false, stage: "auth", error: "ig_auth_error" };
      return { ok: false, stage: "publish", error: "media_create_failed" };
    }

    const creationId = createJson.id as string;
    const ready = await waitUntilReady(creationId, accessToken);
    if (!ready) {
      console.error("[instagram] media not ready before timeout", creationId);
      return { ok: false, stage: "publish", error: "media_not_ready" };
    }

    const publishRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
    });
    const publishJson = await publishRes.json();
    if (!publishRes.ok || !publishJson.id) {
      console.error("[instagram] media publish failed", publishRes.status, publishJson);
      if (isAuthError(publishJson)) return { ok: false, stage: "auth", error: "ig_auth_error" };
      return { ok: false, stage: "publish", error: "media_publish_failed" };
    }

    const permalink = await fetchPermalink(publishJson.id, accessToken);
    return { ok: true, mediaId: publishJson.id, permalink };
  } catch (err) {
    console.error("[instagram] request failed", err);
    return { ok: false, stage: "publish", error: "request_failed" };
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
