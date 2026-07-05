import { randomUUID } from "crypto";
import { deleteJson, getJson, listJson, putJson } from "./blobStore";

export interface PoolItem {
  id: string;
  photoUrl: string;
  keyword: string;
  createdAt: string;
}

const POOL_PREFIX = "pool/";

function pathnameFor(id: string): string {
  return `${POOL_PREFIX}${id}.json`;
}

export async function listPoolItems(): Promise<PoolItem[]> {
  const items = await listJson<PoolItem>(POOL_PREFIX);
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function addPoolItem(photoUrl: string, keyword: string): Promise<PoolItem> {
  const item: PoolItem = { id: randomUUID(), photoUrl, keyword, createdAt: new Date().toISOString() };
  await putJson(pathnameFor(item.id), item);
  return item;
}

export async function getPoolItem(id: string): Promise<PoolItem | null> {
  return getJson<PoolItem>(pathnameFor(id));
}

export async function removePoolItem(id: string): Promise<void> {
  await deleteJson(pathnameFor(id));
}

// プールからランダムに1件選び、プールからは取り除いて返す（空なら null）
export async function pickRandomPoolItem(): Promise<PoolItem | null> {
  const items = await listPoolItems();
  if (items.length === 0) return null;
  const chosen = items[Math.floor(Math.random() * items.length)];
  await removePoolItem(chosen.id);
  return chosen;
}
