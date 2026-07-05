import { NextResponse } from "next/server";
import { removePoolItem } from "@/lib/pool";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await removePoolItem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pool] delete failed", err);
    return NextResponse.json({ error: "delete_failed" }, { status: 502 });
  }
}
