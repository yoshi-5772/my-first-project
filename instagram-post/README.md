# Instagram投稿ツール

店舗の写真から「日本語キャプション＋英訳＋ハッシュタグ5個」の下書きを自動生成し、内容を確認したうえで
自分の意思でボタンを押した時だけInstagramに投稿できるツール。写真には自然な範囲の軽い補正（明るさ・
コントラスト・彩度を少し上げる）を自動で適用する。

## 技術スタック
Next.js (App Router) + TypeScript + Tailwind CSS。Vercelにデプロイし、Serverless FunctionsでClaude API
呼び出し・写真の公開URL化・Instagram Graph API投稿を行う。秘密情報はすべてサーバー側の環境変数に置き、
ブラウザには渡さない。

## Vercelへのデプロイ設定
このプロジェクトは `my-first-project` リポジトリのサブディレクトリとして存在する。Vercelにこのリポジトリを
接続する際、プロジェクト設定の **Root Directory** を `instagram-post` に指定すること
（リポジトリ直下の棚卸しアプリ `index.html` はGitHub Pagesで別ドメイン運用のまま、こちらはVercelの
別ドメインで動く）。

デプロイ後、Vercelダッシュボードで **Storage → Blob** を有効化する（`@vercel/blob` 用。有効化すると
`BLOB_READ_WRITE_TOKEN` が自動で環境変数に追加される）。

## 環境変数（Vercel Project Settings → Environment Variables）
| 変数名 | 用途 |
|---|---|
| `ANTHROPIC_API_KEY` | キャプション生成（Claude API）に使用 |
| `APP_PASSWORD` | このツールにアクセスするための合言葉（ログイン画面で入力） |
| `IG_USER_ID` | 投稿先のInstagramビジネスアカウントのユーザーID |
| `IG_ACCESS_TOKEN` | Instagram長期アクセストークンの初期値（以後は自動リフレッシュされた値を優先使用） |
| `CRON_SECRET` | `/api/refresh-token`・`/api/auto-draft` をVercel Cron以外から叩けないようにするための共有シークレット |
| `BLOB_READ_WRITE_TOKEN` | Vercel BlobをStorageタブで有効化すると自動で追加される（手動設定不要） |
| `RESEND_API_KEY` | 写真プールの自動下書き完成メールを送るための[Resend](https://resend.com)のAPIキー（無料枠あり） |
| `RESEND_FROM_EMAIL` | 送信元アドレス（Resendでドメイン未認証の場合は`onboarding@resend.dev`が使える） |
| `NOTIFY_EMAIL` | 下書き完成・スキップ通知の送り先（お店のオーナーのメールアドレス） |

## Instagramアクセストークンの発行手順とつまずきやすいポイント
今回「Meta開発者アプリでのトークン発行がうまくいかない」という状態から始めているため、以下を順に確認する。

1. **Instagramアカウントの種類**: 対象アカウントが「ビジネス」または「クリエイター」アカウントになっているか
   （個人アカウントのままだとAPI連携できない）
2. **Facebookページとの連携**: そのInstagramアカウントが、自分が管理者権限を持つFacebookページに
   正しく紐付いているか（Instagram側の設定＞アカウントセンターで確認）
3. **Meta開発者アプリの製品追加**: developers.facebook.com のアプリ管理画面で、製品一覧に
   「Instagram」（Instagram API with Instagram Login、または旧来のInstagram Graph API）が
   追加されているか。追加されていないとトークン発行画面自体が出ない・機能しないことが多い
4. **開発モードとテスターアカウント**: アプリが「開発」モードのままの場合、対象のInstagramアカウントを
   そのアプリの「ロール＞テスター」に追加し、Instagram側で招待を承認する必要がある
   （本番公開＝Live化には審査が必要なため、まずは開発モード＋テスター登録で動作確認するのが早い）
5. **短命トークン→長期トークンへの交換**: 発行される最初のトークンは有効期限が短い。
   `grant_type=ig_refresh_token` 等で長期トークン（約60日）に交換するステップを踏んでいるか
6. **権限（スコープ）**: 投稿に必要な `instagram_business_content_publish` 等の権限が許可リストに
   含まれているか

上記を一つずつ潰しても発行できない場合は、実際に出ているエラーメッセージ・エラーコードを控えて
相談すること（エラー文言が分かれば原因を特定しやすい）。

## トークンの自動リフレッシュ
Instagramの長期アクセストークンは約60日で失効する。`vercel.json` のCron設定により、
`/api/refresh-token` が毎日3:00(UTC)に自動実行され、Vercel Blobに最新トークンを保存する
（`api/publish` はこの保存済みトークンを優先し、なければ環境変数 `IG_ACCESS_TOKEN` にフォールバックする）。

**既知の制約**: Vercel Blobは公開読み取りのみのストレージで、非公開ストレージ機能はない。
保存先のURLはランダムなsuffixが付き推測は困難だが、より厳密にトークンを秘匿したい場合は
Vercel KV や Edge Config など非公開ストアへの移行を検討すること（`lib/igToken.ts` を参照）。

リフレッシュが失敗した場合、次回投稿しようとした際に「Instagramとの連携が切れています」という
エラーが画面に表示される。その場合は手動で新しいトークンを発行し `IG_ACCESS_TOKEN` を更新する。

## 写真プール＋自動下書き＋メール承認
「投稿しなきゃ」という毎回の手間を減らすための半自動投稿フロー。

1. `/pool`画面でいつでも写真＋任意のキーワードを追加してためておける（一覧確認・削除も可能）
2. 設定した時刻（`/pool`画面で変更可、デフォルト23:00 JST）になったら、プールからランダムに1枚選び、
   選ばれた写真はプールから削除される
3. 選ばれた写真からキャプション・ハッシュタグを自動生成し「下書き」として保存する
   （**この時点では自動投稿しない**）
4. Resend経由で下書き完成メールが届く。本文中の確認リンク（`/draft/[token]`）から、通常の下書き編集画面と
   同じ内容を確認・編集でき、納得したら手動で「投稿する」を押すとそこで初めてInstagramに投稿される
5. プールが空の日は「今日はスキップしました」というメールが届く
6. `/draft/[token]`のリンクはCookieのログインなしで開ける「知っていれば開ける」形式（パスワードの代わりに
   長いランダムトークンで保護している）。トークンはメール本文以外には出力されないため、メールを共有しない
   限り第三者には推測できない

### スケジュール実行の仕組みとVercel Hobbyプランの制約
`/api/auto-draft`は「設定時刻を過ぎていて、かつ今日はまだ実行していない」場合にだけ実際の処理を行うため、
呼ばれる頻度が多少ズレても正しく1日1回だけ動く。ただし**Vercel Hobbyプランは1つのCron Jobを1日1回しか
実行できない**ため、`vercel.json`にはデフォルト値（23:00 JST = 14:00 UTC）に固定した1日1回のCronのみを
登録している。

- `/pool`画面で時刻を23:00より前に変更した場合: その日のうちには実行されるが、実際に走るタイミングは
  相変わらず23:00のまま（設定した時刻ちょうどには反応しない）
- 23:00より後に変更した場合: 1日1回のCronでは「まだその時刻になっていない」判定が毎日続いてしまい、
  実質動かなくなる

時刻をより正確に反映させたい場合は、無料の外部Cronサービス（例: [cron-job.org](https://cron-job.org)）を
使い、`/api/auto-draft`宛に15〜30分おきなど好きな頻度でGETリクエストを送るよう設定する
（ヘッダーに`Authorization: Bearer <CRON_SECRETの値>`を付与すること）。この方式であれば`/pool`画面で
設定した時刻に対して、外部Cronの実行間隔の精度で反応するようになる。

## ローカル開発
```bash
npm install
cp .env.example .env.local  # 各値を設定
npm run dev
```

## 画像仕様
Instagram Graph APIの要件（JPEG、最大8MB、アスペクト比4:5〜1.91:1）とVercel Functionsの
リクエストボディ上限（既定4.5MB）の両方を満たすよう、クライアント側で4:5に自動クロップし、
3MB以下になるまでJPEG品質を落として圧縮してからアップロードする（`lib/imageEnhance.ts`）。
