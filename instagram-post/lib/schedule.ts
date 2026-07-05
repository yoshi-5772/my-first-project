import { getJson, putJson } from "./blobStore";

// 自動下書き作成の時刻設定（日本時間・24時間表記）とスケジューラの実行状態

export interface ScheduleSettings {
  hour: number; // 0-23 (JST)
  minute: number; // 0-59
}

const SCHEDULE_PATH = "settings/schedule.json";
const DEFAULT_SCHEDULE: ScheduleSettings = { hour: 23, minute: 0 };

export async function getScheduleSettings(): Promise<ScheduleSettings> {
  const data = await getJson<ScheduleSettings>(SCHEDULE_PATH);
  if (!data || !isValidSchedule(data)) return DEFAULT_SCHEDULE;
  return data;
}

export async function saveScheduleSettings(settings: ScheduleSettings): Promise<void> {
  await putJson(SCHEDULE_PATH, settings);
}

export function isValidSchedule(value: unknown): value is ScheduleSettings {
  const v = value as ScheduleSettings;
  return (
    typeof v?.hour === "number" &&
    Number.isInteger(v.hour) &&
    v.hour >= 0 &&
    v.hour <= 23 &&
    typeof v?.minute === "number" &&
    Number.isInteger(v.minute) &&
    v.minute >= 0 &&
    v.minute <= 59
  );
}

interface AutoDraftState {
  lastRunDate: string | null; // JSTでの日付 "YYYY-MM-DD"
}

const STATE_PATH = "settings/auto-draft-state.json";

export async function getLastRunDate(): Promise<string | null> {
  const data = await getJson<AutoDraftState>(STATE_PATH);
  return data?.lastRunDate ?? null;
}

export async function saveLastRunDate(date: string): Promise<void> {
  await putJson(STATE_PATH, { lastRunDate: date } satisfies AutoDraftState);
}

// 日本時間での「今日の日付」と「0:00からの経過分」を返す
export function getJstNow(date: Date = new Date()): { dateStr: string; minutesOfDay: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    minutesOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
}
