import { NextRequest, NextResponse } from "next/server";
import { getScheduleSettings, isValidSchedule, saveScheduleSettings } from "@/lib/schedule";

export async function GET() {
  const schedule = await getScheduleSettings();
  return NextResponse.json(schedule);
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isValidSchedule(body)) {
    return NextResponse.json({ error: "invalid_schedule" }, { status: 400 });
  }
  await saveScheduleSettings(body);
  return NextResponse.json({ ok: true });
}
