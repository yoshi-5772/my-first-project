import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, expectedAuthToken } from "@/lib/auth";

// /api/refresh-tokenはVercel Cronから叩かれるため、Cookie認証の対象外にし
// route.ts側でCRON_SECRETによる別方式の認証を行う
const PUBLIC_PATHS = ["/login", "/api/login", "/api/refresh-token"];

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const expected = await expectedAuthToken();
  const isApi = pathname.startsWith("/api/");

  if (!expected) {
    // APP_PASSWORD未設定のまま公開してしまう事故を防ぐ
    return isApi
      ? NextResponse.json({ error: "server_misconfigured" }, { status: 500 })
      : NextResponse.redirect(new URL("/login", req.url));
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token === expected) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}
