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
| `CRON_SECRET` | `/api/refresh-token` をVercel Cron以外から叩けないようにするための共有シークレット |
| `BLOB_READ_WRITE_TOKEN` | Vercel BlobをStorageタブで有効化すると自動で追加される（手動設定不要） |

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
