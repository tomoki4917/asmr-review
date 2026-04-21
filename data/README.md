# `products.json`

DLsite 作品ごとの **税込現在価格・定価・セール率** など。  
**トップ一覧カード**と**レビュー詳細の価格パネル**（`dlsiteProductId` が一致するとき）のソース。

- **新規レビューで `dlsiteProductId` を付けたら（今後の記事も同じ）**、まず **同じ `id` と作品ページの `url`** を持つオブジェクトを **1 件追加**する。
- 続けてリポジトリルートで **`npm run update-prices`** を実行し、DLsite から税込・セール・期限を取り込む（`package.json` のスクリプト。実体は `scripts/update-prices.mjs`）。手入力だけにせず、**この手順を既定にする**。
- セール終了後に表示だけ古いときは `npm run update-prices:stale` で期限切れ行のみ再取得。
- フィールド: `id`, `url`, `current_price`, `original_price`, `discount_rate`, `on_sale`, `sale_limit`, `sale_end_iso`, `fetched_at`
