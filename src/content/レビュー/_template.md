---
# 複製して「タイトル用フォルダ/index.md」として置く。
# レビュー → src/content/レビュー/<slug>/index.md
# 記事 → src/content/記事/<slug>/index.md（下の contentKind: article を有効化）
#
# フォーマット・文体の正本: unknown-hypno-daijobu-koe-ni-yudanete/index.md（執筆ガイド参照）
# --- 必須・推奨フィールド -----------------------------------------------
# レビュー（星あり）か 記事（星なし）。省略時は review
# contentKind: article

slug: my-first-review

# 一覧・タブ。レビューは「作品名　レビュー」（全角スペース推奨）
title: 作品名　レビュー

# 一覧・OGP。読者向けに魅力・型を2段落程度でも可（| ブロック）
summary: |
  1段落目の紹介。

  2段落目の紹介。

tags:
  - 催眠音声

# レビュー必須（記事では不要）
ratingValue: 9
ratingBest: 10

itemName: 作品名（itemReviewed）

itemDescription: |
  summary と同趣旨の短い説明（構造化データ用）

authorName: 催眠音声レビュー室

publishedAt: "2026-04-18"

# 任意。予約投稿。日付のみ or 日時（日本時間なら +09:00）。dev も既定で尊重。予約前をローカルで見る: REVIEW_IGNORE_GO_LIVE=true
# goLiveAt: "2026-05-01"
# goLiveAt: "2026-04-18T13:59:00+09:00"

# 表紙。ASCII パス推奨: /content/reviews/<slug>/cover.jpg
# coverImage: /content/reviews/my-first-review/cover.jpg

# 任意。ジャケクリックで作品ページへ
# coverAffiliateHref: https://...

affiliateLinks:
  - vendor: dlsite
    href: https://www.dlsite.com/
    label: 体験版はこちら

# DLsite 作品なら推奨。一覧カードの税込・セール表示用。
# → data/products.json に id + url の1件を追加し、ルートで npm run update-prices を実行（執筆ガイド「新規レビューでの価格反映」参照）。
# dlsiteProductId: RJ00000000

# 任意。作品感想見出しの右に丸アイコン（本文に同じ画像を書かない）
# workImpressionAvatar: /content/reviews/my-first-review/avatar.png

# nextSlug: another-post-slug
---

## 作品名

**作品名（フルタイトル）**

---

## 作品概要

### 基本情報

- **サークル：** …
- **種類：** …
- **シナリオ：** …
- **声優：** …
- **イラスト：** …（任意）
- **収録形式：** …（任意）

### 収録の長さ（パッケージ表記より）

- **本編（本レビュー対象）：** 約 **0:00**
- 派生トラックがある場合は箇条書きで追加

### パートの長さ（目安）

先頭に、区切り方の前提を一文（文字起こしベースの目安である旨など）。

- **01** パート名 … 約 **0:00**
- **02** …

### 聴取時の身体反応（心拍）

心拍ログを載せる作品のみ。導入文・画像・波形の読みは執筆ガイド「聴取時の身体反応（心拍）— 標準フォーマット」に従う。画像は `/content/reviews/<slug>/polar_h10_heart_rate_session.jpg`。

### 作品評価グラフ

各軸は10点満点です。**トランス度**は…、**快楽度**は…、**満足度**は…を表します。

![作品評価グラフ（トランス度・快楽度・満足度）](/content/reviews/my-first-review/review_triangle.png)

---

## どんな人におすすめか

- …
- …

**合わない人:** …

---

## 総合評価

**★9／10**

- **価格：** …
- **セール：** …（任意）
- **クーポン：** …（任意）
- **体験版：** …

価格やキャンペーンは変更されることがあります。

---

### 作品解説と感想

## 作品像

販売文・構成・テンポ・バイノーラル等の**総論**（段落複数可）。

---

## パート解説

### パート名（約 0:00–0:00）

> 台詞引用（作品の実際の文言に寄せる）

引用の直後に、その台詞の働きと技法の補助線を**解説段落**で書く。**引用 → 解説 → 引用 → 解説**の順を守る。長尺では同一パートに引用が複数あってよい。

---

## 作品感想

今回はサークル名「〇〇」様の新作を聞かせていただきました。

本作は…。…

では、良き催眠ライフを👋
