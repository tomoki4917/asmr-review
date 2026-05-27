# 催眠音声記事原紙（B 型ガワ）

完成系 B 型の記事**ガワ**（`asmr-saimin-aman-toro-lip` 準拠）。**本文の初稿はここに手で書かない。**

## 記事モード「解析データ」（3ボタン）

B 型原紙の `## 本作の誘導・暗示解析詳細` は、サイト上で次の2つに分かれて表示される（`index.md` は1本のまま）。

| タブ | 内容 |
|------|------|
| **解析データ** | 四表のみ（`### 誘導構成比` 〜 `### 本作で特に強い暗示特性`） |
| **作品詳細解析** | `### 主要誘導の流れ（作品の流れ）` 以降 ＋ 総評三柱 |

**分割境界** … 見出し **`### 主要誘導の流れ（作品の流れ）`** の直前（文言変更禁止）。  
実装: `splitBodyForArticleMode`（`src/lib/split-review-body.ts`）。  
詳細: `docs/真催眠音声執筆ガイド.md` §1（補・記事モード「解析データ」フォーマット）

## 本文執筆（必須）

本書どおりの読者向け本文は **`scripts/gemini-hypnosis-review/auto_review.py`**（Gemini API）で生成する。

```powershell
cd scripts\gemini-hypnosis-review
py -3 prepare_analysis_inputs.py "C:\path\to\解析フォルダ"
py -3 auto_review.py --slug <slug> --item-name "…" --analysis-dir "…" --force
```

詳細: `docs/真催眠音声執筆ガイド.md` §1（補・本文執筆は Gemini AI）

## ガワだけ作る（任意）

```bash
npm run review:create-genkami -- <slug> --item-name "【ASMR×催○音声】作品名"
```

プレースホルダを人が埋めず、直後に `auto_review.py` を実行する。

**サイトに載せない原紙プレビュー** … `src/content/レビュー/genkami-preview/` は `excludeFromReviewIndex: true`（一覧・トップ・サイトマップ非表示）。本番用 slug ではこのフラグを付けない。

### 主なオプション

| オプション | 説明 |
|------------|------|
| `--item-name` | 販売ページの商品名（必須推奨） |
| `--circle` | サークル名（`circleName` と基本情報） |
| `--rj` | `dlsiteProductId`（例: `RJ312554`） |
| `--recommended-lv` | 推奨感度 Lv（1〜5、既定 `2`） |
| `--dry-run` | 書き込まず標準出力のみ |

### 生成物

- `src/content/レビュー/<slug>/index.md` … 原紙（未執筆）または Gemini 上書き後の本文
- `src/content/レビュー/<slug>/_分析データ.json` … スコア未設定のひな形（Gemini 実行で更新）

### 執筆後のチェック（人手）

1. `quickGuideBySlug` に slug を追加（`src/app/(public)/reviews/[slug]/page.tsx`）
2. `data/products.json` ＋ `npm run update-price:one RJ…`
3. `py -3 scripts/generate_review_triangle.py <slug>`
4. `npm run review:audit-kansei -- <slug>`
5. 正本: `docs/真催眠音声執筆ガイド.md` §1（補・完成系 B 型）・§1（補・記事モード「解析データ」フォーマット）
6. 公開前: 記事モードが **3ボタン**（四表＋境界見出しあり）であること
