import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

interface CaptionResult {
  caption_ja: string;
  caption_en: string;
  hashtags: string[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[caption] ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ stage: "caption", error: "server_misconfigured" }, { status: 500 });
  }

  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  const keyword = form?.get("keyword");
  if (!(photo instanceof Blob)) {
    return NextResponse.json({ stage: "caption", error: "photo_required" }, { status: 400 });
  }

  const arrayBuffer = await photo.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mediaType = photo.type || "image/jpeg";
  const keywordText = typeof keyword === "string" ? keyword.trim() : "";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              { type: "text", text: buildPrompt(keywordText) },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[caption] anthropic api error", res.status, detail);
      return NextResponse.json({ stage: "caption", error: "caption_failed" }, { status: 502 });
    }

    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    const parsed = parseCaptionResult(text);
    if (!parsed) {
      console.error("[caption] unparseable response", text);
      return NextResponse.json({ stage: "caption", error: "caption_failed" }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[caption] request failed", err);
    return NextResponse.json({ stage: "caption", error: "caption_failed" }, { status: 502 });
  }
}

// このお店ならではの特徴。キャプションに自然に盛り込めそうな場合に活用する（毎回無理に入れなくてよい）。
// 今後さらに特徴を追加したい場合はこの配列に足す
const STORE_FACTS = [
  "ステーキは炭火で焼いている",
  "デミグラスソースは自家製で、5日間かけてじっくり煮込んで作っている",
  "デミグラスソースには胡椒を4種類調合して使っている",
  "隠れ家的な雰囲気のお店",
  "カウンター8席、2階にテーブル席がある",
  "ワイン各種、日本酒も取り揃えている",
  "お弁当も承っている",
  "煮込み料理には「はと肉」という牛肉の前脚部分の希少部位を使用している",
  "ステーキソースは香味野菜と醤油ベースで、2週間ほど熟成させてから使用している",
  "サラダドレッシングは自家製のフレンチドレッシング",
];

function buildPrompt(keyword: string): string {
  const base = `これは飲食店のInstagram投稿用の写真です。このキャプションは個人の感想や日記ではなく、
**お店の公式アカウントからお客様に向けて発信するもの**です。以下の点を守って、
以下をJSON形式のみで出力してください（説明文や前置き、コードブロックは不要）。

- 「食べた」「作った」のような個人の日記調ではなく、料理の魅力を伝えてお客様の来店・注文の意欲を
  そそる、お店からの発信として書く
- 敬体（です・ます調）で、親しみやすいが丁寧なトーンにする
- 誇張しすぎず、写真から読み取れる範囲で具体的な魅力（食感、香り、見た目など）を伝える

このお店の特徴（写真の内容に合っていて、文章として不自然にならない場合は盛り込む。無理にすべて
使う必要はない）:
${STORE_FACTS.map((fact) => `- ${fact}`).join("\n")}

ハッシュタグ（ちょうど5個、日本語と英語を混ぜる）は以下のルールを必ず守ること:
- 1個は店舗の所在地（岩手県盛岡市）に関するタグを必ず入れる。表記は「#盛岡」「#岩手」「#盛岡グルメ」
  「#Morioka」「#Iwate」「#MoriokaJapan」のように、日本語・英語のどちらでもよく、投稿ごとに変えてよい
- 1個は「ステーキ」に関するタグを必ず入れる（例: 「#ステーキ」「#Steak」「#steaklover」など、
  日本語・英語どちらでもよい）
- 残り3個は、写真に写っている具体的な内容（食材・調理法・盛り付けなど）に関連するタグにする

{
  "caption_ja": "お店からお客様へ向けた、短く魅力的な日本語キャプション（1〜2文）",
  "caption_en": "caption_jaの自然な英訳（直訳ではなく、海外のお客様にも伝わる自然な英語表現。同じくお店発信のトーンを保つ）",
  "hashtags": ["上記ルールに従ったハッシュタグをちょうど5個"]
}`;
  if (!keyword) return base;
  return `${base}\n\nキャプションには次の言葉やテーマを絡めてください: 「${keyword}」`;
}

function parseCaptionResult(text: string): CaptionResult | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const data = JSON.parse(cleaned);
    if (
      typeof data.caption_ja === "string" &&
      typeof data.caption_en === "string" &&
      data.caption_ja.trim().length > 0 &&
      data.caption_en.trim().length > 0 &&
      Array.isArray(data.hashtags)
    ) {
      const hashtags = (data.hashtags as unknown[])
        .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
        .map((h) => (h.startsWith("#") ? h : `#${h}`))
        .slice(0, 5);
      if (hashtags.length === 0) return null;
      return { caption_ja: data.caption_ja, caption_en: data.caption_en, hashtags };
    }
  } catch {
    return null;
  }
  return null;
}
