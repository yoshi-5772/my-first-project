// Resend経由のメール通知。RESEND_API_KEY/RESEND_FROM_EMAIL/NOTIFY_EMAILは
// すべてVercelの環境変数で設定する（README参照）

async function sendEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.NOTIFY_EMAIL;
  if (!apiKey || !from || !to) {
    console.error("[email] RESEND_API_KEY / RESEND_FROM_EMAIL / NOTIFY_EMAIL is not set");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[email] resend send failed", res.status, detail);
  }
}

export async function sendDraftReadyEmail(reviewUrl: string, captionJa: string): Promise<void> {
  const html = `
    <p>今夜の投稿候補の下書きができました。</p>
    <p style="white-space:pre-wrap">${escapeHtml(captionJa)}</p>
    <p><a href="${reviewUrl}">こちらから内容を確認・編集して投稿する</a></p>
    <p style="color:#888;font-size:12px">このリンクは今回の下書き専用です。投稿するまで何度でも開けます。</p>
  `;
  await sendEmail("【下書き完成】今夜の投稿候補を確認してください", html);
}

export async function sendPoolEmptyEmail(): Promise<void> {
  const html = `<p>写真プールに写真がなかったため、今日の下書き作成はスキップしました。</p>`;
  await sendEmail("今日はスキップしました（写真プールが空でした）", html);
}

export async function sendAutoDraftFailedEmail(reviewUrl: string): Promise<void> {
  const html = `
    <p>写真は選ばれましたが、キャプションの自動生成に失敗しました。</p>
    <p><a href="${reviewUrl}">こちらから写真を確認し、手動でキャプションを作成してください</a></p>
  `;
  await sendEmail("【要確認】下書き作成でエラーが発生しました", html);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
