# 進捗サマリー（次のセッション用）

このファイルは、セッションをまたいで作業を再開できるようにするための引き継ぎメモ。
次にこのプロジェクトの続きを依頼するときは、このファイルの内容を伝えれば続きから進められる。

## リポジトリ・デプロイ構成
- GitHubリポジトリ: `yoshi-5772/my-first-project`（`instagram-post/` サブディレクトリ内に実装）
- Vercelプロジェクト: チーム`golot`配下、Root Directory = `instagram-post`
- 棚卸しアプリ（リポジトリ直下`index.html`）とは別ドメイン・別ホスティング（GitHub Pages）で共存

## 実装済み機能
- Next.js (App Router) + TypeScript + Tailwind CSS
- パスワード認証（`middleware.ts` + Cookie、`APP_PASSWORD`で保護）
- 写真加工（`lib/imageEnhance.ts`）: 4:5クロップ、控えめな明るさ/コントラスト/彩度補正、JPEG圧縮
- キャプション生成（`app/api/generate-caption`）: Claude Vision APIで日本語・英語キャプション＋ハッシュタグ5個を生成
  - お店の公式発信トーン（です・ます調、来店意欲を誘う文章）
  - ハッシュタグは盛岡/岩手系＋ステーキ系を必須、残り3個は写真内容に関連
  - `STORE_FACTS`配列に店舗の特徴（デミグラス5日仕込み・胡椒4種調合、隠れ家的、カウンター8席+2階テーブル席、
    ワイン/日本酒、お弁当対応、希少部位「はと肉」、2週間熟成ステーキソース、自家製フレンチドレッシング、
    炭火焼き）を登録。写真に明確に一致する時だけ・稀に（3〜4回に1回程度）・最大1つだけ触れるよう指示
- キャプション短縮ボタン（`app/api/shorten-caption`）
- 写真アップロード（`app/api/upload` → Vercel Blob、Public設定で接続済み）
- Instagram投稿（`app/api/publish`）: media作成→status_codeポーリング→media_publish、実行前に確認ダイアログ
  （取り消し不可の明示・二重送信ガード）
- アクセストークン自動リフレッシュ（`app/api/refresh-token` + Vercel Cron）
- 下書き自動保存（localStorage）、投稿文まるごとコピー機能
- UIコンポーネント: `PhotoStep`（撮影/選択+キーワード）, `DraftEditor`（キャプション編集+作り直す+短くする+コピー）,
  `ConfirmDialog`
- 【実装完了】写真プール＋自動下書き＋メール承認（詳細はREADME.mdの同名セクション参照）
  - `/pool`画面: 写真＋キーワードをプールに追加・一覧・削除、自動下書き作成時刻の設定（デフォルト23:00 JST）
  - `/api/auto-draft`（`CRON_SECRET`保護、`vercel.json`で1日1回23:00 JST固定のVercel Cron登録済み）:
    設定時刻を過ぎていて今日未実行ならプールからランダムに1枚選出→キャプション自動生成→下書き保存→
    Resendでメール通知。プールが空ならスキップメール
  - `/draft/[token]`: メール内リンクからCookie認証なしで開ける確認・編集・投稿画面（トークン自体が認証）
  - Vercel Hobbyプランはcronが1日1回までのため、23:00より後の時刻に変更した場合は組み込みcronだけでは
    反応しない。より正確な時刻に対応させたい場合は外部の無料`cron-job.org`等で`/api/auto-draft`を
    15〜30分おきに叩く運用が必要（README参照、未設定）
  - 併せてキャプション生成・Instagram投稿・投稿文組み立てのロジックを`lib/caption.ts`・`lib/instagram.ts`・
    `lib/postText.ts`に切り出し、手動投稿フローと自動下書きフローの両方から共有するようリファクタリング済み

## 環境変数の設定状況（Vercel）
- `APP_PASSWORD` 設定済み
- `ANTHROPIC_API_KEY` 設定済み・動作確認済み
- `BLOB_READ_WRITE_TOKEN` Blob Store接続済み（Public）
- `CRON_SECRET` 設定済み
- `IG_USER_ID` 未設定
- `IG_ACCESS_TOKEN` 未設定
- `RESEND_API_KEY` 未設定（写真プール機能のメール通知に必要、要Resend新規登録）
- `RESEND_FROM_EMAIL` 未設定
- `NOTIFY_EMAIL` 未設定（通知の送り先アドレス）

## 現在のブロッカー：Instagramアクセストークン未発行
Meta for Developers登録の途中、Facebookアカウントが作成したばかりのため「普段使っていないデバイス」という
Meta側のセキュリティ警告でブロックされている。PC・スマホ両方の端末で発生済み＝デバイス個別ではなく
アカウント自体の信頼度不足が原因。

- 対処法: 既存の古いFacebookアカウントがあればそちらを使うのが最速。なければ、プロフィール整備・友達追加・
  毎日の通常利用を1〜2週間続けてアカウントを育てる
- Instagram側は既にプロアカウント（ビジネス/クリエイター）化済み
- developers.facebook.comへの再アクセスは信頼度が上がるまで控えるのが良い

## 次にやること
1. **Resendの登録**: resend.comでアカウント作成し、`RESEND_API_KEY`を発行。ドメイン未認証なら
   `RESEND_FROM_EMAIL=onboarding@resend.dev`で暫定運用可。`NOTIFY_EMAIL`にオーナーの受信用アドレスを設定
2. Vercelに上記3つの環境変数を設定し、`/pool`画面から実際に写真を追加→`/api/auto-draft`を手動で
   （`curl`等でCRON_SECRET付きで）叩いて一連の動作（下書き作成→メール受信→`/draft/[token]`で確認・投稿）
   を一度通しで検証する
3. Instagramアクセストークンの発行（下記ブロッカー参照）が解消し次第、実際にInstagramへの投稿まで検証
4. 時刻をデフォルト以外にしたい場合はcron-job.org等の外部Cron設定（任意）
