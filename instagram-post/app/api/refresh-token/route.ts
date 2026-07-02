import { NextRequest, NextResponse } from "next/server";
import { cleanupOldTokens, getCurrentAccessToken, saveAccessToken } from "@/lib/igToken";

export const maxDuration = 30;

// Vercel Cronから定期実行される。CRON_SECRETをVercelの環境変数に設定しておくと、
// CronからのリクエストにVercelが自動で `Authorization: Bearer $CRON_SECRET` を付与する
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const currentToken = await getCurrentAccessToken();
  if (!currentToken) {
    console.error("[refresh-token] no current token available");
    return NextResponse.json({ error: "no_token" }, { status: 500 });
  }

  try {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", currentToken);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[refresh-token] refresh failed", res.status, detail);
      return NextResponse.json({ error: "refresh_failed" }, { status: 502 });
    }
    const json = await res.json();
    if (typeof json.access_token !== "string") {
      console.error("[refresh-token] unexpected response", json);
      return NextResponse.json({ error: "refresh_failed" }, { status: 502 });
    }
    await saveAccessToken(json.access_token);
    await cleanupOldTokens();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[refresh-token] request failed", err);
    return NextResponse.json({ error: "refresh_failed" }, { status: 502 });
  }
}
