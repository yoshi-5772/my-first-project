import { put } from "@vercel/blob";

// 投稿用写真をVercel Blobにアップロードして公開URLを返す。
// 手動投稿（/api/upload）と写真プールへの追加（/api/pool）の両方から使う
export async function uploadPhoto(photo: Blob): Promise<string> {
  const filename = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const result = await put(filename, photo, {
    access: "public",
    contentType: "image/jpeg",
  });
  return result.url;
}
