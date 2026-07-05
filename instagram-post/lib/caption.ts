// キャプション生成・短縮のロジック本体。
// 手動投稿フロー（/api/generate-caption, /api/shorten-caption）と
// 自動下書き作成フロー（/api/auto-draft, /api/draft/[token]/regenerate）の両方から使う

export interface CaptionResult {
  caption_ja: string;
  caption_en: string;
  hashtags: string[];
}

export interface ShortenResult {
  caption_ja: string;
  caption_en: string;
}

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export async function generateCaption(
  apiKey: string,
  imageBase64: string,
  mediaType: string,
  keyword: string,
): Promise<CaptionResult | null> {
  const res = await callAnthropic(apiKey, ANTHROPIC_MODEL, 500, [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: buildCaptionPrompt(keyword) },
      ],
    },
  ]);
  if (res === null) return null;
  return parseCaptionResult(res);
}

export async function shortenCaption(
  apiKey: string,
  captionJa: string,
  captionEn: string,
): Promise<ShortenResult | null> {
  const res = await callAnthropic(apiKey, ANTHROPIC_MODEL, 300, [
    { role: "user", content: buildShortenPrompt(captionJa, captionEn) },
  ]);
  if (res === null) return null;
  return parseShortenResult(res);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  maxTokens: number,
  messages: unknown[],
): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[caption] anthropic api error", res.status, detail);
    return null;
  }
  const json = await res.json();
  return json?.content?.[0]?.text ?? "";
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

function buildCaptionPrompt(keyword: string): string {
  const base = `これは飲食店のInstagram投稿用の写真です。このキャプションは個人の感想や日記ではなく、
**お店の公式アカウントからお客様に向けて発信するもの**です。以下の点を守って、
以下をJSON形式のみで出力してください（説明文や前置き、コードブロックは不要）。

- 「食べた」「作った」のような個人の日記調ではなく、料理の魅力を伝えてお客様の来店・注文の意欲を
  そそる、お店からの発信として書く
- 敬体（です・ます調）で、親しみやすいが丁寧なトーンにする
- 誇張しすぎず、写真から読み取れる範囲で具体的な魅力（食感、香り、見た目など）を伝える

このお店の特徴（下記）は、キャプションの隠し味程度に使ってよい情報であり、必須の要素ではない:
${STORE_FACTS.map((fact) => `- ${fact}`).join("\n")}

特徴の使い方について、以下を厳守すること:
- 写真に写っている料理・要素と明確に一致する特徴だけを候補にする（例: デミグラスやはと肉の煮込みが
  実際に写っている時だけ、それに関する特徴に触れてよい。ステーキの写真にデミグラスや煮込みの話を
  混ぜない）
- 一致する特徴があっても、毎回は使わない。基本的には特徴に触れずに写真の見た目だけで書き、
  体感で3〜4回に1回程度だけ、思い出したように軽く触れる
- 一致する特徴が複数あっても、無理に全部盛り込まず、使うとしても多くて1つだけにする

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

function buildShortenPrompt(captionJa: string, captionEn: string): string {
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

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseCaptionResult(text: string): CaptionResult | null {
  try {
    const data = JSON.parse(stripCodeFence(text));
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

function parseShortenResult(text: string): ShortenResult | null {
  try {
    const data = JSON.parse(stripCodeFence(text));
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
