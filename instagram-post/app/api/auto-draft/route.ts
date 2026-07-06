import { NextRequest, NextResponse } from "next/server";
import { runAutoDraftOnce } from "@/lib/runAutoDraft";
import { getJstNow, getLastRunDate, getScheduleSettings, saveLastRunDate } from "@/lib/schedule";

export const maxDuration = 60;

// 外部スケジューラ（Vercel Cronや無料のcron-job.org等）から一定間隔で呼ばれる想定。
// 「設定時刻を過ぎていて、かつ今日はまだ実行していない」場合にだけ実際の処理を行う。
// Vercel Hobbyプランは1日1回しかCronを実行できないため、任意の時刻に細かく反応させたい場合は
// cron-job.org等で15〜30分おきにこのエンドポイントを叩くようにする（README参照）
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const schedule = await getScheduleSettings();
  const { dateStr, minutesOfDay } = getJstNow();
  const lastRunDate = await getLastRunDate();

  if (lastRunDate === dateStr) {
    return NextResponse.json({ ok: true, skipped: "already_ran" });
  }
  const scheduledMinutes = schedule.hour * 60 + schedule.minute;
  if (minutesOfDay < scheduledMinutes) {
    return NextResponse.json({ ok: true, skipped: "not_yet" });
  }

  // 同時実行での二重処理を避けるため、実処理の前に「今日実行済み」を記録する
  await saveLastRunDate(dateStr);

  const result = await runAutoDraftOnce(req.nextUrl.origin);
  return NextResponse.json(result);
}
