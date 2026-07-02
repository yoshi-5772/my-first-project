// 失敗ステージごとに「要約」と「次に取るべき行動」を定義する。
// 生の例外・APIエラー文言はサーバーログにのみ出し、UIにはここのメッセージだけを表示する

export type FailureStage = "caption" | "upload" | "auth" | "publish";

export interface ErrorPresentation {
  title: string;
  actionLabel: string;
  actionKind: "retry" | "reauth";
}

const PRESENTATIONS: Record<FailureStage, ErrorPresentation> = {
  caption: {
    title: "キャプションの生成に失敗しました。電波状況を確認してもう一度お試しください。",
    actionLabel: "もう一度キャプションを作る",
    actionKind: "retry",
  },
  upload: {
    title: "写真のアップロードに失敗しました。もう一度お試しください。",
    actionLabel: "アップロードをやり直す",
    actionKind: "retry",
  },
  auth: {
    title: "Instagramとの連携が切れています。再連携が必要です。",
    actionLabel: "Instagramに再連携する",
    actionKind: "reauth",
  },
  publish: {
    title: "投稿に失敗しました。もう一度お試しください。",
    actionLabel: "もう一度投稿する",
    actionKind: "retry",
  },
};

export function presentError(stage: FailureStage): ErrorPresentation {
  return PRESENTATIONS[stage];
}

export function isFailureStage(value: unknown): value is FailureStage {
  return value === "caption" || value === "upload" || value === "auth" || value === "publish";
}
