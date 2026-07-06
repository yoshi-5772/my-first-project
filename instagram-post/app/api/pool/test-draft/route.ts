import { NextRequest, NextResponse } from "next/server";
import { runAutoDraftOnce } from "@/lib/runAutoDraft";

export const maxDuration = 60;

// /pool画面から手動でその場実行するためのテスト用エンドポイント。
// 通常のCookie認証で保護され、スケジュール判定は一切行わず即座に本処理を実行する
export async function POST(req: NextRequest) {
  const result = await runAutoDraftOnce(req.nextUrl.origin);
  return NextResponse.json(result);
}
