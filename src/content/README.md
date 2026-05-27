# レビュー・記事（Markdown）の置き場所

## 1. フォルダ構成

ビルドで読み込まれるのは次の **2 つのフォルダだけ**です（`src/content/` 直下の `.md` は一覧に出ません）。

トップ一覧の **税込・セール価格**はフロントマターの `dlsiteProductId` と、リポジトリ直下 **`data/products.json`** の対応行で決まる（執筆ガイド・`data/README.md` 参照）。**新規レビュー追加時は** `products.json` に **`id` + `url`** を足したうえで **`npm run update-prices`** を実行し、過去記事と同じくサイト由来の価格に揃える（詳細は執筆ガイド「新規レビューでの価格反映」）。**作品レビュー**ではフロントマターに **`saleDate`**（販売ページの発売日に準じた `YYYY-MM-DD`）を記録する（執筆ガイド・`src/lib/types.ts`）。

| フォルダ | 用途 |
|----------|------|
| `src/content/レビュー/` | 星ありの**作品レビュー**（`contentKind` 省略または `review`） |
| `src/content/記事/` | 星なしの**解説記事**（`contentKind: article`） |

**同人音声レビュー（R18）**（`tags` に `同人音声` または `authorName: 同人音声レビュー室`）の執筆正本は **`src/content/記事/_同人音声執筆ガイド2.md`** と **`src/content/レビュー/dakimakura-kanojo-pretty-holic-yurukawa-kouhai/index.md`**（`.cursor/rules/review-doujin-canon.mdc`）。

**全年齢同人音声レビュー**（`tags` に `全年齢同人` または `authorName: 同人音声解析室`・`/all-ages/` 掲載予定）の執筆正本は **`src/content/記事/_全年齢同人執筆ガイド.md`**（五軸の第4軸は **入眠・覚醒**。母本は `_同人音声執筆ガイド2.md`）。`.cursor/rules/review-all-ages-doujin-canon.mdc`。

催眠レビューの**完成系（主）**は `docs/催眠音声執筆ガイド.md` ＋ 見本 `kuchikou-saimin-count-trip-nouiki` ＋ `scripts/gemini-hypnosis-review/`。サイト構造・監査は `docs/真催眠音声執筆ガイド.md`（補助）。

**作品レビューを新規追加するとき（再発防止・記事モード）:** 詳細ページの **記事モード**（クイック解析／作品詳細解析の切替）はコード側の登録が必要です。`index.md` の **`slug`** と同じキーで、`src/app/(public)/reviews/[slug]/page.tsx` 内の **`quickGuideBySlug`** にオブジェクトを **1 件追加**してください。抜けると切替 UI 自体が表示されません（Cursor 向けの常時ルール: `.cursor/rules/review-article-mode-quickguide.mdc`）。

それぞれの中に、**1 本につき 1 フォルダ**を作り、本文は **`index.md`** に書きます。

例:

```text
src/content/
  レビュー/
    作品名やスラッグのフォルダ名/
      index.md
      cover.jpg          ← 表紙など（index と同じフォルダにまとめる）
      図1.png             ← 本文用・素材も同様
  記事/
    記事タイトルに合わせたフォルダ名/
      index.md
      cover.jpg
  README.md          ← この説明（ビルド対象外）
```

- **フォルダ名**は管理しやすい名前なら日本語でも英数字でも構いません（URL はフロントマターの **`slug`** で決まります）。
- **`index.md` を置いたフォルダ名**が、フロントマターで `slug` を省略したときの既定スラッグになります（例: `記事/hypnosis-mechanism-01/index.md` → 既定 `hypnosis-mechanism-01`）。
- フォルダ直下に `other.md` のように別名の `.md` を置いても読み込まれますが、**運用は `index.md` に統一**することを推奨します。

## 2. テンプレート

`src/content/レビュー/_template.md` を複製し、適切なフォルダに `index.md` として置いてください（`_` で始まるファイルはビルド対象外です）。

**`summary` / `itemDescription` の改行:** 詳細ページ上部の紹介文を段落分けしたいときは、フロントマターで YAML の `|`（リテラルブロック）を使い、**段落の間に空行**を入れてください（`SummaryMarkdown` が複数の `<p>` として表示します）。文言はそのままで改行だけ足す形でも構いません。

- **星なしの解説記事**にする場合は `contentKind: article` を付け、`記事/` 側のフォルダに置きます。トップの「**記事**」欄に出ます（「レビュー一覧」と評価フィルタの対象外）。`ratingValue` / `ratingBest` は不要です。
- レビューの**満点**は `ratingBest`（省略時は **10**）。一覧の絞り込みは 10 段階に換算した点数で一致します。

## 3. 下書き・テンプレだけ公開したくないとき

- ファイル名を **`_` で始める**（例: `_draft.md`）と一覧・ビルド対象外になります。
- `README.md` などのドキュメントも対象外です。
- **原紙プレビュー**（`genkami-preview`）はフロントマター **`excludeFromReviewIndex: true`** で一覧・トップ・サイトマップから除外（URL直打ち・執筆確認用のみ）。

## 3b. 既存レビューの改稿（公開日）

**記事の内容だけ更新**するときは、**初回公開日の `publishedAt` を変えない**（例: 全面改稿で `2026-05-27` に上書きしない）。`goLiveAt` を新規予約として付け直す必要がなければ触らない。

## 4. 画像・素材（index と同じフォルダにまとめる）

**推奨:** `index.md` と**同じフォルダ**に、表紙・本文用画像・下書きメモ以外の素材を置きます（`.md` 以外。`_` で始まるファイル名は同期対象外）。

静的サイトではブラウザから見えるのは `public/` だけのため、次の仕組みがあります。

1. **原本** … `src/content/レビュー/...` または `src/content/記事/...` の各フォルダ内。
2. **同期** … `npm run dev` の起動時・`npm run build` の前に、`scripts/sync-content-assets.mjs` が上記フォルダ内の **`.md` 以外**を `public/content/レビュー/`・`public/content/記事/` にコピーします（`.gitignore` 済み。リポジトリに載るのは `src` 側だけでよいです）。
3. **パスの書き方** … フォルダ名を揃えて `/` から始める URL で参照します。

例（フォルダ名が `dry-orgasm-what-is` のとき）:

- フロントマター: `coverImage: /content/記事/dry-orgasm-what-is/cover.jpg`
- 本文・summary 内: `![図](/content/記事/dry-orgasm-what-is/fig1.png)`

**開発中に画像だけ追加したとき**は、同期をかけ直してください（`npm run sync:content-assets`、または dev サーバーを一度止めて `npm run dev` し直し）。

**サムネイル（一覧・カード・詳細）:** フロントマターの `coverImage` で指定します。次の3記事は、フォルダ内の **日本語名 JPG**（`催眠音声とは.jpg` 等）を同期スクリプトが **ASCII の URL** に複製するため、`coverImage` は次のように書けます。

- `/content/hypnosis-what-is.jpg` ← `記事/hypnosis-mechanism-01/催眠音声とは.jpg`
- `/content/reviews/nou-iki-toha/cover.jpg` ← `記事/nou-iki-toha/脳イキとは.jpg`
- `/content/reviews/dry-orgasm-what-is/cover.jpg` ← `記事/dry-orgasm-what-is/ドライオーガズムとは.jpg`

他の記事は `cover.jpg` を置き、必要なら `scripts/sync-content-assets.mjs` の `LEGACY_ARTICLE_COVERS` に行を追加してください。

外部ホストの画像は従来どおり `https://...` で指定可能です。

## 5. トップ一覧への反映（静的エクスポート）

このプロジェクトは **`next.config` の `output: "export"`** により、**ビルド時**に Markdown を読み込みます。

### 予約投稿（`goLiveAt`）のしくみ（ここを誤ると「自動で出ない」）

#### 既定の予約時刻（エージェント・執筆）

**ユーザーから `goLiveAt` を明示指示されない限り**、新規レビューの予約は次とする。

1. 既存の `src/content/レビュー/**/index.md` で **`goLiveAt` が付いているもの**のうち、**最も遅い `goLiveAt` の暦日（JST）**を「最新予約投稿日」とみなす。
2. **新規の `goLiveAt`** … **その翌日 12:00 JST**（例: 最新が `2026-05-03T20:00:00+09:00` なら `2026-05-04T12:00:00+09:00`）。
3. **`publishedAt`** … 原則 **`goLiveAt` と同日**の `YYYY-MM-DD`。

初稿で `goLiveAt` 付きレビューが他に無い場合は、執筆日の翌日 12:00 JST を仮にし、必要なら運用者に確認する。

---

1. **`goLiveAt` はサーバーが時刻を見て切り替える仕組みではない。** `npm run build` が走ったときの **`new Date()`** と `goLiveAt` を比較し、その時点で「まだ早い」レビューは一覧・サイトマップから外れ、詳細は「予約公開」プレースホルダの HTML になる。
2. **予約時刻を過ぎたあと、必ず本番向けのビルド＋デプロイがもう一度必要。** プッシュだけで昼にビルドしたまま夜に何もしなければ、夜の `goLiveAt` になっても本番は更新されない。
3. **既定の自動化** … GitHub Actions **Schedule Vercel deploy** が **JST 21:05 と 22:00**（UTC `5 12` / `0 13`）に走り、**Vercel 上で本番ビルド**が立つ想定。**推奨**は Actions secrets に **`VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`** を入れ、**Vercel CLI で `deploy --prod`** する方式（Deployments に確実に行が付きやすい）。**代替**として **`VERCEL_DEPLOY_HOOK_URL` のみ**でも可（Deploy Hook の POST）。**どちらも無い**とジョブは失敗し、予約は自動で拾われない。
4. **`goLiveAt` をその日の 22:00 より後ろにした記事**は、当日の 2 本の日次ビルドではまだ非表示のままになる。翌日 21:05 以降のビルドで初めて載る（またはその前に手動でデプロイする）。

- **検証用サーバー（`npm run dev` / `npm run start` / `dev:lan` 等）** … `goLiveAt` は**既定で無視**され、**予約日時より前でも一覧・詳細に表示**されます（`npm_lifecycle_event` が `dev` または `start` のとき）。Docker 等で npm が無い場合は **`REVIEW_PREVIEW_SERVER=true`**。本番と同じ除外を試すときは **`REVIEW_RESPECT_GO_LIVE=true`**。
- **本番の静的ファイル（GitHub Pages 等）** … 記事を追加・変更したら **必ず `npm run build` を実行し、生成物をデプロイ**してください。`prebuild` でアセット同期が走ります。`goLiveAt` は **ビルドを実行した瞬間の時刻**と比較されるため、本番で「ちょうどその分まで」公開したい場合は、その時刻**以降**にデプロイする。日次は **JST 21:05・22:00 前後**に Actions が走る想定（GitHub の負荷で **数分〜十数分遅れる**ことがある）。
- **定期デプロイが走らない／本番が更新されないとき** … GitHub → **Actions** → **Schedule Vercel deploy** の直近実行を確認。失敗する典型は **CLI 用 3 つも Hook も未設定**、ワークフローが**デフォルトブランチに無い**、リポジトリ長期無操作でスケジュール停止、など。詳細は `.github/workflows/schedule-vercel-deploy.yml`。**急ぎなら** Actions で **Run workflow** を実行するか、Vercel から **Redeploy** する。
- **Actions は緑なのに Vercel の Deployments に一行も増えないとき** … **推奨対処: 下記「日次デプロイの設定」で Vercel CLI 方式に切り替える。** Hook だけだと URL 取り違えで **HTTP は成功してもデプロイが立たない**ことがある。

### 日次デプロイの設定（推奨: Vercel CLI）

1. **Vercel** → アカウント **Settings** → **Tokens** で **Create** し、トークンをコピー（漏洩したら再発行）。
2. **手元のリポジトリルート**で `npx vercel@latest login` のあと `npx vercel@latest link` を実行し、このプロジェクトを紐づける（対話で Team / Project を選択）。
3. 生成された **`.vercel/project.json`** を開き、`orgId` と `projectId` の値をコピーする（このファイルは **Git にコミットしない**。`.gitignore` に `.vercel` を含める）。
4. **GitHub** → リポジトリ **Settings** → **Secrets and variables** → **Actions** に、次の **Repository secrets** を追加する。  
   - **`VERCEL_TOKEN`** … 手順 1 のトークン  
   - **`VERCEL_ORG_ID`** … `orgId`  
   - **`VERCEL_PROJECT_ID`** … `projectId`  
5. **Actions** → **Schedule Vercel deploy** → **Run workflow** で試し、**Vercel → Deployments** に新しい Production ビルドが付くか確認する。

**Hook のみ使う場合**は従来どおり **`VERCEL_DEPLOY_HOOK_URL`** だけでも動く。CLI 用 3 つが**すべて**入っているときは **CLI が優先**され、Hook は使われない。

---

質問があればリポジトリのメンテナに確認してください。
