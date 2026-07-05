import { NextResponse } from "next/server";
import { getPendingDraft } from "@/lib/pendingDraft";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const draft = await getPendingDraft(token);
  if (!draft) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ draft });
}
