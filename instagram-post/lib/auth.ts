export const COOKIE_NAME = "ig_auth";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180日

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// APP_PASSWORD自体はCookieに載せず、そのハッシュ値だけをセッショントークンとして扱う
export async function expectedAuthToken(): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;
  return sha256Hex(password);
}
