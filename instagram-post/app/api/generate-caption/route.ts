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

function buildPrompt(keyword: string): string {
  const base = `これは飲食店のInstagram投稿用の写真です。このキャプションは個人の感想や日記ではなく、
**お店の公式アカウントからお客様に向けて発信するもの**です。以下の点を守って、
以下をJSON形式のみで出力してください（説明文や前置き、コードブロックは不要）。

- 「食べた」「作った」のような個人の日記調ではなく、料理の魅力を伝えてお客様の来店・注文の意欲を
  そそる、お店からの発信として書く
- 敬体（です・ます調）で、親しみやすいが丁寧なトーンにする
- 誇張しすぎず、写真から読み取れる範囲で具体的な魅力（食感、香り、見た目など）を伝える

{
  "caption_ja": "お店からお客様へ向けた、短く魅力的な日本語キャプション（1〜2文）",
  "caption_en": "caption_jaの自然な英訳（直訳ではなく、海外のお客様にも伝わる自然な英語表現。同じくお店発信のトーンを保つ）",
  "hashtags": ["日本語と英語を混ぜた、海外のお客様にも届くハッシュタグをちょうど5個"]
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
