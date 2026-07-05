import { NextRequest, NextResponse } from "next/server";
import { generateCaption } from "@/lib/caption";
import { sendAutoDraftFailedEmail, sendDraftReadyEmail, sendPoolEmptyEmail } from "@/lib/email";
import { generateDraftToken, savePendingDraft, type PendingDraft } from "@/lib/pendingDraft";
import { pickRandomPoolItem } from "@/lib/pool";
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

  const picked = await pickRandomPoolItem();
  if (!picked) {
    await sendPoolEmptyEmail();
    return NextResponse.json({ ok: true, skipped: "pool_empty" });
  }

  const token = generateDraftToken();
  const reviewUrl = new URL(`/draft/${token}`, req.nextUrl.origin).toString();

  const draft: PendingDraft = {
    token,
    photoUrl: picked.photoUrl,
    keyword: picked.keyword,
    captionJa: "",
    captionEn: "",
    hashtags: [],
    status: "pending",
    permalink: null,
    createdAt: new Date().toISOString(),
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const generated = apiKey ? await tryGenerateCaption(apiKey, picked.photoUrl, picked.keyword) : null;

  if (generated) {
    draft.captionJa = generated.caption_ja;
    draft.captionEn = generated.caption_en;
    draft.hashtags = generated.hashtags;
    await savePendingDraft(draft);
    await sendDraftReadyEmail(reviewUrl, draft.captionJa);
  } else {
    await savePendingDraft(draft);
    await sendAutoDraftFailedEmail(reviewUrl);
  }

  return NextResponse.json({ ok: true, token });
}

async function tryGenerateCaption(apiKey: string, photoUrl: string, keyword: string) {
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = res.headers.get("content-type") || "image/jpeg";
    return await generateCaption(apiKey, base64, mediaType, keyword);
  } catch (err) {
    console.error("[auto-draft] caption generation failed", err);
    return null;
  }
}
