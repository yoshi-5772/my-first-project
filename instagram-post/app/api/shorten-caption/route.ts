import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

interface ShortenResult {
  caption_ja: string;
  caption_en: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[shorten] ANTHROPIC_API_KEY is not set");
    return NextResponse.json({ stage: "caption", error: "server_misconfigured" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const captionJa = typeof body?.captionJa === "string" ? body.captionJa.trim() : "";
  const captionEn = typeof body?.captionEn === "string" ? body.captionEn.trim() : "";
  if (!captionJa || !captionEn) {
    return NextResponse.json({ stage: "caption", error: "caption_required" }, { status: 400 });
  }

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
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: buildPrompt(captionJa, captionEn),
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[shorten] anthropic api error", res.status, detail);
      return NextResponse.json({ stage: "caption", error: "shorten_failed" }, { status: 502 });
    }

    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    const parsed = parseShortenResult(text);
    if (!parsed) {
      console.error("[shorten] unparseable response", text);
      return NextResponse.json({ stage: "caption", error: "shorten_failed" }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[shorten] request failed", err);
    return NextResponse.json({ stage: "caption", error: "shorten_failed" }, { status: 502 });
  }
}

function buildPrompt(captionJa: string, captionEn: string): string {
  return `以下は飲食店の公式Instagramアカウントが投稿するキャプションです。同じ「お店からお客様への発信」
というトーン（敬体・お客様の来店意欲をそそる内容）を保ったまま、もっと短く・端的なキャッチコピー風の
一文に詰めてください。説明文や前置き、コードブロックは不要で、以下のJSON形式のみで出力してください。

日本語キャプション: ${captionJa}
英語キャプション: ${captionEn}

{
  "caption_ja": "上記を詰めた、短く端的な日本語キャプション（一文）",
  "caption_en": "caption_jaの自然な英訳（直訳ではなく、海外のお客様にも伝わる自然な英語表現）"
}`;
}

function parseShortenResult(text: string): ShortenResult | null {
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
      data.caption_en.trim().length > 0
    ) {
      return { caption_ja: data.caption_ja, caption_en: data.caption_en };
    }
  } catch {
    return null;
  }
  return null;
}
