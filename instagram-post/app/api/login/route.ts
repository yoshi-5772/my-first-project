import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_MAX_AGE, COOKIE_NAME, sha256Hex } from "@/lib/auth";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const real = process.env.APP_PASSWORD;
  if (!real) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || !safeEqual(password, real)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const token = await sha256Hex(real);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    // 本番(Vercel)は常にHTTPSなのでsecureを付ける。ローカル開発(http)ではsecureだと
    // Cookieが送信されずログインループになるため開発時のみ外す
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
