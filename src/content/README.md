# レビュー・記事（Markdown）の置き場所

## 1. フォルダ構成

ビルドで読み込まれるのは次の **2 つのフォルダだけ**です（`src/content/` 直下の `.md` は一覧に出ません）。

トップ一覧の **税込・セール価格**はフロントマターの `dlsiteProductId` と、リポジトリ直下 **`data/products.json`** の対応行で決まる（執筆ガイド・`data/README.md` 参照）。**新規レビュー追加時は** `products.json` に **`id` + `url`** を足したうえで **`npm run update-prices`** を実行し、過去記事と同じくサイト由来の価格に揃える（詳細は執筆ガイド「新規レビューでの価格反映」）。

| フォルダ | 用途 |
|----------|------|
| `src/content/レビュー/` | 星ありの**作品レビュー**（`contentKind` 省略または `review`） |
| `src/content/記事/` | 星なしの**解説記事**（`contentKind: article`） |

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

- **開発中（`npm run dev`）** … 起動時にアセット同期のあとサーバーが立ちます。`index.md` を保存したあとブラウザを更新すると本文は反映されます。フロントマターの **`goLiveAt`（予約投稿）は dev でも既定で尊重**されます（現在時刻が `goLiveAt` より前なら一覧・詳細に出ません）。予約前の全文をローカルで確認したいときだけ、環境変数 **`REVIEW_IGNORE_GO_LIVE=true`** を付けて起動してください。
- **本番の静的ファイル（GitHub Pages 等）** … 記事を追加・変更したら **必ず `npm run build` を実行し、生成物をデプロイ**してください。`prebuild` でアセット同期が走ります。`goLiveAt` は **ビルドを実行した瞬間の時刻**と比較されるため、本番で「ちょうどその分まで」公開したい場合は、その時刻**以降**にデプロイ（例: 毎日 JST 14:00 の Vercel フック）が必要です。

---

質問があればリポジトリのメンテナに確認してください。
