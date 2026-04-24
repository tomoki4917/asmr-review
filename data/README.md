# `products.json`

DLsite 作品ごとの **税込現在価格・定価・セール率** など。  
**トップ一覧カード**と**レビュー詳細の価格パネル**（`dlsiteProductId` が一致するとき）のソース。

- **新規レビューで `dlsiteProductId` を付けたら（今後の記事も同じ）**、まず **同じ `id` と作品ページの `url`** を持つオブジェクトを **1 件追加**する。
- 続けてリポジトリルートで **`npm run update-prices`** を実行し、DLsite から税込・セール・期限を取り込む（`package.json` のスクリプト。実体は `scripts/update-prices.mjs`）。手入力だけにせず、**この手順を既定にする**。
- セール終了後に表示だけ古いときは `npm run update-prices:stale` で期限切れ行のみ再取得。
- フィールド: `id`, `url`, `current_price`, `original_price`, `discount_rate`, `on_sale`, `sale_limit`, `sale_end_iso`, `fetched_at`

## Search Console（商品スニペット）との関係

レビュー詳細の JSON-LD は `src/components/ReviewJsonLd.tsx` が **`@graph`** で `Review` と `Product` を出す。Google が `Product` に求める **`offers` / `review` / `aggregateRating`** のうち、`review` と `aggregateRating` は常にコードで付与し、価格が取れているときだけ `offers` を追加する。  
手でページに別の `Product` マークアップを足さない（重複・不整合で GSC のエラー原因になる）。価格表示・`offers` のため、上記の **`dlsiteProductId` + `products.json` + `update-prices`** は従来どおり推奨。
