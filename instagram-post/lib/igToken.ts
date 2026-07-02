import { del, list, put } from "@vercel/blob";

// リフレッシュしたInstagramアクセストークンの保管場所。
// 注意: Vercel Blobは公開読み取りのみ対応（非公開ストレージ機能はない）。
// URLは書き込み時にランダムなsuffixが付くため推測は困難だが、より厳密な秘匿性が必要な場合は
// Vercel KV / Edge Config 等の非公開ストアへの移行を検討すること（README参照）
const TOKEN_PREFIX = "ig-token/";

interface StoredToken {
  accessToken: string;
  updatedAt: string;
}

export async function getCurrentAccessToken(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: TOKEN_PREFIX });
    if (blobs.length > 0) {
      const latest = [...blobs].sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))[0];
      const res = await fetch(latest.url, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as StoredToken;
        if (data.accessToken) return data.accessToken;
      }
    }
  } catch (err) {
    console.error("[igToken] failed to read stored token", err);
  }
  // リフレッシュ結果がまだ一度も保存されていない場合は環境変数の初期値にフォールバック
  return process.env.IG_ACCESS_TOKEN ?? null;
}

export async function saveAccessToken(accessToken: string): Promise<void> {
  const payload: StoredToken = { accessToken, updatedAt: new Date().toISOString() };
  await put(`${TOKEN_PREFIX}${Date.now()}.json`, JSON.stringify(payload), {
    access: "public",
    contentType: "application/json",
  });
}

export async function cleanupOldTokens(): Promise<void> {
  try {
    const { blobs } = await list({ prefix: TOKEN_PREFIX });
    const sorted = [...blobs].sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    const stale = sorted.slice(1);
    if (stale.length === 0) return;
    await Promise.all(stale.map((b) => del(b.url)));
  } catch (err) {
    console.error("[igToken] cleanup failed", err);
  }
}
