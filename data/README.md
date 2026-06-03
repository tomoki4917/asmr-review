# `products.json`

DLsite 作品ごとの **税込現在価格・定価・セール率** など。  
**トップ一覧カード**と**レビュー詳細の価格パネル**（`dlsiteProductId` が一致するとき）のソース。

- **新規レビューで `dlsiteProductId` を付けたら（今後の記事も同じ）**、まず **同じ `id` と作品ページの `url`** を持つオブジェクトを **1 件追加**する。
- 続けてリポジトリルートで **`npm run update-prices`** を実行し、DLsite から税込・セール・期限を取り込む（`package.json` のスクリプト。実体は `scripts/update-prices.mjs`）。手入力だけにせず、**この手順を既定にする**。
- **追加した行だけすぐ反映したいとき** … `node scripts/fetch-one-price.mjs RJ01234567` または `npm run update-price:one -- RJ01234567`（1 作品のみ GET。**`fetched_at` が空の `current_price: 0` はプレースホルダーで、無料ではない** — 必ず本コマンドで取り込む）。
- **ビルド前チェック** … `npm run validate:dlsite-prices`（`prebuild` に含む。`fetched_at` 未設定のレビューがあると失敗）。
- セール終了後に表示だけ古いときは `npm run update-prices:stale` で期限切れ行のみ再取得。
- フィールド: `id`, `url`, `current_price`, `original_price`, `discount_rate`, `on_sale`, `sale_limit`, `sale_end_iso`, **`release_date_iso`**（DLsite `regist_date` 由来。発売から7日以内は一覧・詳細で「新作」バッジ）, `fetched_at`

## Search Console（商品スニペット）との関係

レビュー詳細の JSON-LD は `src/components/ReviewJsonLd.tsx` が **`@graph`** で `Review` と `Product` を出す。Google が `Product` に求める **`offers` / `review` / `aggregateRating`** のうち、`review` と `aggregateRating` は常にコードで付与し、価格が取れているときだけ `offers` を追加する。  
手でページに別の `Product` マークアップを足さない（重複・不整合で GSC のエラー原因になる）。価格表示・`offers` のため、上記の **`dlsiteProductId` + `products.json` + `update-prices`** は従来どおり推奨。

---

# `dlsite-rankings.json`

DLsite **ランキング順位**（トップのブログパーツと同じ `site: home`）。一覧カード・詳細の **「7日間 ○位」バッジ** のソース。

## 取りに行くために必要なもの

| 項目 | 内容 |
|------|------|
| **ネットワーク** | ビルド／開発マシンから `www.dlsite.com` へ HTTPS で到達できること |
| **依存** | リポジトリに入っている `axios`（`devDependencies`。価格取得と同じ） |
| **レビュー側** | 対象記事のフロントマターに **`dlsiteProductId`（RJ）** があること |
| **実行** | リポジトリルートで **`npm run update-dlsite-rankings`** |
| **任意** | `DLSITE_RANKING_SITE=maniax` … 同人専用ランキング軸に切り替え（既定は `home`＝トップ総合） |

ブラウザから DLsite API を直接叩くことは **CORS なしのため不可**。静的サイトでは **JSON をコミットまたはデプロイ前に更新**する運用になる。

## 更新の目安

- API は **各期間あたり最大 31 位** まで（`day` / `week` / `month` / `year` / `total` をまとめて取得）
- バッジ表示は **`week`（週間ランキング）・`month`（月間ランキング）**（該当する期間だけ **1期間＝1枚** で縦に並べる）
- 順位は DLsite 側で変わるため、**週1回程度**または **デプロイ前**に `update-dlsite-rankings` を回すとよい
- `fetched_at` … 最終取得時刻（ISO）

## フィールド

- `site` … `home` または `maniax`
- `fetched_at`
- `periods.week.entries[]` … `{ rank, product_id }`（他の `period` も同構造）
