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
    fact: "ステーキは炭火で、何度も休ませながらじっくり焼き上げている",
  },
  {
    appliesTo:
      "デミグラスソースを使った料理（ハンバーグ、赤ワイン煮込み、ビーフシチュー、オムライス）が写っている写真のみ",
    fact: "デミグラスソースは自家製で、4〜5日かけてじっくり仕込んでいる",
  },
  {
    appliesTo:
      "デミグラスソースを使った料理（ハンバーグ、赤ワイン煮込み、ビーフシチュー、オムライス）が写っている写真のみ",
    fact: "デミグラスソースには、すじ肉・香味野菜・屑野菜・肉の切れ端まで無駄にせず使い切り、ブイヨン・トマト・赤ワインを合わせている。スパイスは丁子（クローブ）・ローリエ・黒胡椒",
  },
  {
    appliesTo:
      "デミグラスソースを使った料理（ハンバーグ、赤ワイン煮込み、ビーフシチュー、オムライス）が写っている写真のみ",
    fact: "デミグラスソースはさまざまな料理に使う、このお店の味の土台になっている",
  },
  {
    appliesTo: "焼いたステーキ肉そのものが写っている写真のみ",
    fact: "ステーキにはサーロイン・ヒレ・ランプ・イチボ・ミスジ・ウデ三角・シンタマ・シンシン・カメノコ・マルカワ・トモサンカク・内ももなど、さまざまな部位を使っており、どの部位を出すかは日によって変わる",
  },
  {
    appliesTo: "焼いたステーキ肉そのものが写っている写真のみ",
    fact: "ステーキに使う胡椒は、黒・白・緑・ピンクの4種類をオリジナルブレンドしたもの",
  },
  {
    appliesTo: "煮込み料理が写っている写真のみ",
    fact: "煮込み料理には「はと肉（俵）」という前すね肉の超希少部位を使用している",
  },
  {
    appliesTo: "ステーキにソースがかかっている、またはソースが添えられている写真のみ",
    fact: "ステーキソースは香味野菜・ワイン・醤油を使ったオリジナルで、2週間熟成させてから使用している",
  },
  {
    appliesTo: "ローストビーフが写っている写真のみ",
    fact: "ローストビーフはランチやコースの一品として提供している",
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

interface MeatTerm {
  /** ひとことキーワード欄にこの語が含まれていたときだけ知識を渡す */
  aliases: string[];
  label: string;
  description: string;
}

// 肉の部位・種別の知識。写真だけでは部位を正確に見分けられないため、
// キーワード欄で部位が明示されたときにだけ渡し、AIの推測による誤情報を防ぐ
const MEAT_KNOWLEDGE: MeatTerm[] = [
  {
    aliases: ["サーロイン", "sirloin"],
    label: "サーロイン",
    description:
      "背中側の部位で「ステーキの王様」とも呼ばれる。赤身とサシのバランスがよく、濃厚な味わいととろけるような食感が持ち味",
  },
  {
    aliases: ["ヒレ", "フィレ", "シャトーブリアン", "テンダーロイン", "fillet", "filet"],
    label: "ヒレ",
    description:
      "運動量が極端に少ない部位のため、牛肉の中で最もやわらかい。脂が少なく上品な味わい。1頭から4〜5kgしか取れず、中心部のシャトーブリアンは600g前後とさらに希少",
  },
  {
    aliases: ["ランプ"],
    label: "ランプ",
    description:
      "腰からお尻にかけての大きな赤身。サシは入りにくいがキメが細かくやわらかく、旨味が強い。脂が少なくあっさりしていて、程よい噛み応えがある",
  },
  {
    aliases: ["イチボ", "いちぼ"],
    label: "イチボ",
    description:
      "お尻の先にあたる希少部位。赤身のしっかりした旨味と、ほどよく入った霜降りの甘みを併せ持つ。1頭からわずかしか取れない",
  },
  {
    aliases: ["ミスジ", "みすじ"],
    label: "ミスジ",
    description:
      "肩甲骨の内側にある希少部位。3本のスジが名前の由来。細かいサシが入り、濃厚な味わいとやわらかさが特徴",
  },
  {
    aliases: ["赤身"],
    label: "赤身",
    description:
      "脂に頼らず、噛むほどに肉そのものの旨味が広がるのが持ち味。脂が重くないので最後まで食べ飽きない",
  },
  {
    aliases: ["はと肉", "ハト肉", "はとにく", "俵", "たわら"],
    label: "はと肉（俵）",
    description:
      "前すね肉にある一部の超希少部位。よく煮込むととてもやわらかくなるのが持ち味で、当店では煮込み料理に使用している",
  },
  {
    aliases: ["内もも", "ウチモモ", "うちもも", "ウチヒラ"],
    label: "内もも（ウチヒラ）",
    description:
      "モモの中で最も大きな赤身のかたまり。きめはやや粗めだが脂が少なく、濃い赤身の味わいが楽しめる",
  },
  {
    aliases: ["外もも", "ソトモモ", "そともも", "ソトヒラ"],
    label: "外もも（ソトヒラ）",
    description:
      "牛の体重を支える筋肉質な部位でしっかりした噛み応えがあり、赤身の味が濃い。ナカニク・シキンボ・ハバキなどに分けられる",
  },
  {
    aliases: ["ナカニク", "中肉", "なかにく"],
    label: "ナカニク（中肉）",
    description:
      "外ももから取れる部位。繊維が多くしっかりした肉質で、脂がほとんどないぶん赤身の濃厚な甘みを感じられる",
  },
  {
    aliases: ["シキンボ", "しきんぼ", "シキンボウ"],
    label: "シキンボ",
    description:
      "外ももの外側にある細長い円柱状の部位で、金の延べ棒に形が似ていることが名前の由来。サシがほぼない純粋な赤身で、繊維の向きが揃っているため直角に薄く切ると歯切れがよい。どこを切っても均一な丸いスライスになるためローストビーフに最適で、当店でもローストビーフに使用している",
  },
  {
    aliases: ["ハバキ", "はばき"],
    label: "ハバキ",
    description: "外ももから取れる色の濃い赤身。赤身が濃いぶん旨味もしっかりしている",
  },
  {
    aliases: ["シンタマ", "しんたま", "芯玉"],
    label: "シンタマ",
    description:
      "ももの丸いかたまり部位。シンシン・カメノコ・マルカワ・トモサンカクの4つに分けられる",
  },
  {
    aliases: ["シンシン", "しんしん", "マルシン", "芯芯"],
    label: "シンシン（マルシン）",
    description:
      "シンタマの中心部にある部位で、ヒレの次にやわらかいと言われる。きめが細かく、ローストビーフにも向く",
  },
  {
    aliases: ["カメノコ", "かめのこ", "亀の子"],
    label: "カメノコ（亀の子）",
    description:
      "シンシンを覆うようにある部位。断面が亀の甲羅に似ていることが名前の由来",
  },
  {
    aliases: ["マルカワ", "まるかわ", "丸皮"],
    label: "マルカワ（丸皮）",
    description:
      "シンタマからシンシンとカメノコを外して取れる部位。スジが多く、丁寧な下処理が欠かせない",
  },
  {
    aliases: ["トモサンカク", "ともさんかく", "とも三角", "友三角"],
    label: "トモサンカク（とも三角）",
    description:
      "後ろ脚側「トモ」についた三角形の部位。赤身が中心のシンタマの中では珍しく、程よく霜降りが入る",
  },
  {
    // 「クリ」単体は「クリスマス」などに誤って一致するため別名に入れない
    aliases: ["ウデ三角", "腕三角", "うで三角", "クリミ", "肩三角"],
    label: "ウデ三角（クリ）",
    description:
      "ミスジに隣接した、肩から前脚にかけての大きな三角形の部位（上腕三頭筋）。よく動く筋肉質な部位でしっかりした食感があり、赤身にほどよくサシが入ったさっぱりとした味わい",
  },
  {
    aliases: ["経産牛", "けいさん牛", "ケイサン牛", "けいさんぎゅう"],
    label: "経産牛",
    description:
      "出産を経験した雌牛。年齢を重ねることで筋肉中のタンパク質が分解され、グルタミン酸やイノシン酸といった旨み成分が増えるため、噛むほどに広がる深い旨みとコクが魅力。脂の融点が低く、しつこさが少ない",
  },
  {
    aliases: ["メス", "雌牛", "めす牛"],
    label: "メス牛",
    description:
      "肉質のキメが細かく、サシが繊細に入る。不飽和脂肪酸が多く脂の融点が低いため、口の中でとろけるような口当たりになる",
  },
  {
    // 「オス」単体は「オススメ」に誤って一致するため別名に入れない
    aliases: ["オス牛", "去勢", "雄牛", "おす牛"],
    label: "オス牛（去勢牛）",
    description:
      "去勢することで脂がのりやすくやわらかい肉質に育つ。メスより大きく育ち、赤身の力強さが持ち味",
  },
];

function findMeatKnowledge(keyword: string): MeatTerm[] {
  if (!keyword) return [];
  const normalized = keyword.toLowerCase();
  return MEAT_KNOWLEDGE.filter((term) =>
    term.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
  );
}

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

次のことは絶対に書かない:
- 肉の部位名。ステーキに使う部位は日によって変わるうえ、写真から部位を見分けることはできない。
  キーワードで部位が明示されている場合のみ、その部位に触れてよい
- 牛の産地や銘柄。仕入れは日によって変わるため、特定の産地・ブランド名は一切出さない
- 「絶品」「激安」「お得」「コスパ」など安っぽく響く言葉や、価格の安さ・値ごろ感を訴える表現。
  このお店は安売りで選ばれたいわけではないので、素材と仕事の丁寧さで魅力を伝える

今回の書き口の指定（この方向で書くこと）: ${angle}

文章のバリエーションについて:
- 「〜をご堪能いただけます」「〜が輝き」など、毎回出てきがちな決まり文句に頼らない
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

  let prompt = `${base}\n\nキャプションには次の言葉やテーマを絡めてください: 「${keyword}」`;

  // キーワードで部位・種別が明示されたときだけ、その知識を渡す
  const meatTerms = findMeatKnowledge(keyword);
  if (meatTerms.length > 0) {
    prompt += `\n\nキーワードで指定された肉の部位・種別についての知識（正確な情報なので、この範囲でなら
言及してよい。ただし説明的になりすぎないよう、使うとしても魅力が伝わる一点に絞ること）:
${meatTerms.map(({ label, description }) => `- ${label}: ${description}`).join("\n")}`;
  }

  return prompt;
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
