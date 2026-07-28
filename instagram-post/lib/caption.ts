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

interface StoreFact {
  /** この特徴に触れてよい写真の条件。ここに当てはまらない写真では絶対に使わせない */
  appliesTo: string;
  fact: string;
}

// このお店ならではの特徴。写真の被写体と条件が一致したときだけ、隠し味として使う。
// 今後さらに特徴を追加したい場合はこの配列に足す
const STORE_FACTS: StoreFact[] = [
  {
    appliesTo: "焼いたステーキ肉そのものが写っている写真のみ",
    fact: "ステーキは炭火で焼いている",
  },
  {
    appliesTo: "茶色いデミグラスソースがかかった料理が写っている写真のみ",
    fact: "デミグラスソースは自家製で、5日間かけてじっくり煮込んで作っている",
  },
  {
    appliesTo: "茶色いデミグラスソースがかかった料理が写っている写真のみ",
    fact: "デミグラスソースには胡椒を4種類調合して使っている",
  },
  {
    appliesTo: "煮込み料理が写っている写真のみ",
    fact: "煮込み料理には「はと肉」という牛肉の前脚部分の希少部位を使用している",
  },
  {
    appliesTo: "ステーキにソースがかかっている、またはソースが添えられている写真のみ",
    fact: "ステーキソースは香味野菜と醤油ベースで、2週間ほど熟成させてから使用している",
  },
  {
    appliesTo: "サラダが写っている写真のみ",
    fact: "サラダドレッシングは自家製のフレンチドレッシング",
  },
  {
    appliesTo: "ワインまたは日本酒（ボトル・グラス）が写っている写真のみ",
    fact: "ワイン各種、日本酒も取り揃えている",
  },
  {
    appliesTo: "店内の様子・カウンター・テーブル席が写っている写真のみ",
    fact: "隠れ家的な雰囲気で、カウンター8席と2階のテーブル席がある",
  },
  {
    appliesTo: "お弁当・折詰・テイクアウト容器が写っている写真のみ",
    fact: "お弁当も承っている",
  },
];

// 毎回似た文章にならないよう、リクエストごとに書き口を1つ選んで指示する
const WRITING_ANGLES = [
  "焼ける音や立ちのぼる香りなど、五感に訴える描写を軸にする",
  "断面・照り・焼き色など、写真の中の一点にぐっと寄って描く",
  "どんな気分・シーンで楽しんでほしいかを、お客様に語りかけるように書く",
  "食材や部位そのものの持ち味を主役にして紹介する",
  "説明を削ぎ落とし、短く印象に残るコピーのように書く",
  "その日の時間帯や季節の空気感に軽く触れてから料理につなげる",
  "ひと口目にどんな感覚が広がるかを想像させる書き方にする",
];

function buildCaptionPrompt(keyword: string): string {
  const angle = WRITING_ANGLES[Math.floor(Math.random() * WRITING_ANGLES.length)];
  const base = `これは飲食店のInstagram投稿用の写真です。このキャプションは個人の感想や日記ではなく、
**お店の公式アカウントからお客様に向けて発信するもの**です。以下の点を守って、
以下をJSON形式のみで出力してください（説明文や前置き、コードブロックは不要）。

- 「食べた」「作った」のような個人の日記調ではなく、料理の魅力を伝えてお客様の来店・注文の意欲を
  そそる、お店からの発信として書く
- 敬体（です・ます調）で、親しみやすいが丁寧なトーンにする
- 誇張しすぎず、写真から読み取れる範囲で具体的な魅力（食感、香り、見た目など）を伝える

まず写真を丁寧に観察し、何の料理が写っているのかを正確に見極めてから書くこと。
ステーキ・ハンバーグ・煮込みなどを取り違えたまま書かない。写真から確実に読み取れないことは書かない。

今回の書き口の指定（この方向で書くこと）: ${angle}

文章のバリエーションについて:
- 「〜をご堪能いただけます」「〜が輝き」「絶品」など、毎回出てきがちな決まり文句に頼らない
- 書き出しのパターンを固定しない（毎回「料理名＋。」で始めない）
- 一文だけの短いキャプションでもよい。長さも毎回変えてよい

このお店の特徴（下記）は、キャプションの隠し味程度に使ってよい情報であり、必須の要素ではない。
各項目の【 】内は、その特徴に触れてよい写真の条件:
${STORE_FACTS.map(({ appliesTo, fact }) => `- 【${appliesTo}】${fact}`).join("\n")}

特徴の使い方について、以下を厳守すること:
- 【 】の条件に写真が当てはまらない場合は、その特徴に絶対に触れない。
  特に「炭火」はステーキ肉を焼く場合にのみ使う調理法であり、ハンバーグ・煮込み・その他の料理の
  写真で炭火に言及することは事実として誤りなので、絶対に書かない
- 条件に当てはまる特徴があっても、毎回は使わない。基本的には特徴に触れずに写真の見た目だけで書き、
  体感で3〜4回に1回程度だけ、思い出したように軽く触れる
- 条件に当てはまる特徴が複数あっても、無理に全部盛り込まず、使うとしても多くて1つだけにする

ハッシュタグ（ちょうど5個、日本語と英語を混ぜる）は以下のルールを必ず守ること:
- 1個は店舗の所在地（岩手県盛岡市）に関するタグを必ず入れる。表記は「#盛岡」「#岩手」「#盛岡グルメ」
  「#Morioka」「#Iwate」「#MoriokaJapan」のように、日本語・英語のどちらでもよく、投稿ごとに変えてよい
- 1個は「ステーキ」に関するタグを必ず入れる（例: 「#ステーキ」「#Steak」「#steaklover」など、
  日本語・英語どちらでもよい）
- 残り3個は、写真に写っている具体的な内容（食材・調理法・盛り付け・シーンなど）に関連するタグにする。
  毎回同じ顔ぶれにならないよう、写真ごとに切り口を変えて選ぶ

{
  "caption_ja": "お店からお客様へ向けた、短く魅力的な日本語キャプション（1〜2文。指定された書き口に沿って書く）",
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
