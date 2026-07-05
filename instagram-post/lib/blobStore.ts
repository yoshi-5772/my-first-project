import { del, list, put } from "@vercel/blob";

// pathnameを指定してJSONデータを直接読み書きするための汎用ヘルパー。
// addRandomSuffix:falseで固定パスに保存し、list({prefix: pathname})で
// そのパス自体を検索してURLを得てから中身をfetchする（del/headはURL指定のため）

export async function putJson(pathname: string, data: unknown): Promise<void> {
  await put(pathname, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

export async function getJson<T>(pathname: string): Promise<T | null> {
  const { blobs } = await list({ prefix: pathname });
  const match = blobs.find((b) => b.pathname === pathname);
  if (!match) return null;
  const res = await fetch(match.url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function listJson<T>(prefix: string): Promise<T[]> {
  const { blobs } = await list({ prefix });
  const results: (T | null)[] = await Promise.all(
    blobs.map(async (b): Promise<T | null> => {
      const res = await fetch(b.url, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as T;
    }),
  );
  return results.filter((r): r is T => r !== null);
}

export async function deleteJson(pathname: string): Promise<void> {
  const { blobs } = await list({ prefix: pathname });
  const match = blobs.find((b) => b.pathname === pathname);
  if (match) await del(match.url);
}
