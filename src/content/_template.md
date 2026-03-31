---
# --- 必須・推奨フィールド -----------------------------------------------
# レビュー（星あり・「レビュー一覧」）か 記事（星なし・「記事」欄）か。省略時は review
# contentKind: article

# 記事の URL 末尾になります（英小文字・数字・ハイフン推奨）。未指定時はファイルパスから自動生成されます。
slug: my-first-review

# 一覧カード・ブラウザタブに出るタイトル
title: 作品タイトルと一言

# 紹介文（OGP・詳細ページ上部）。プレーンでも Markdown 可。画像: ![alt](https://...) または ![alt](/content/foo.png)
summary: メタディスクリプション・一覧用。120文字前後が目安。

# 1つ以上。一覧のタグ表示に使われます。
tags:
  - 癒やし
  - ASMR

# レビュー（contentKind が review または省略）のとき必須。記事では不要。
ratingValue: 4.5
# 省略時は 5 扱い
ratingBest: 5

# Schema.org（構造化データ）用。作品名として使われます。
itemName: 作品名（itemReviewed）

# 任意。未指定時は summary が使われることがあります。
itemDescription: 作品の短い説明

authorName: あなたの名前

# ISO 日付推奨（一覧の並びは新しい順）
publishedAt: "2026-03-29"

# 任意。省略可（省略時はリンクなし）。1件以上ある場合は vendor / href が必須。
affiliateLinks:
  - vendor: dlsite
    href: https://www.dlsite.com/
    label: DLsiteで見る
  # - vendor: amazon
  #   href: https://www.amazon.co.jp/...
  #   label: Amazonで見る

# --- 任意フィールド -----------------------------------------------------
# 表紙。public 配下なら / から。外部 URL も可。
# coverImage: /content/my-cover.jpg
---

ここから **Markdown** で本文を書けます。

## 見出し

- リスト
- も OK

画像を本文に出す例:

```markdown
![説明](https://example.com/image.png)
```
