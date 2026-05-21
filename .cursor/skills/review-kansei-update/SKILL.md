---
name: review-kansei-update
description: >-
  レビュー index.md を完成系（正本 kuchikou + docs/真催眠音声執筆ガイド.md）へ1本ずつ更新する。
  ユーザーが「完成系」「次の1本」「kansei」+ slug と言ったとき、または review:audit-kansei の未完了を直すときに使う。
---

# 完成系レビュー更新（1本ずつ）

## 精度を落とさない前提

- **この Skill は「手順と検査」を固定するだけ**。文章の質は **1 slug ＝ 1セッション** で正本を読んで書く。
- **一括スクリプトで本文を自動生成しない**（表記置換の機械チェックのみ `npm run review:audit-kansei`）。
- 感度Lvカードの HTML は **`kuchikou-saimin-count-trip-nouiki/index.md` からコピー**し、閉じタグは必ず `</div>`（`</motion>` 禁止）。
- 日本語 md を PowerShell の `Set-Content -NoNewline` で保存しない（UTF-8 破損）。

## トリガー（ユーザー向け）

| ユーザーが言う | やること |
|----------------|----------|
| `次の1本` / `完成系: 次` | `npm run review:audit-kansei -- --next` で slug を決める |
| `完成系: <slug>` | その slug だけ更新 |
| slug 省略 | 必ず `--next` で1本に限定（複数本を1メッセージでやらない） |

## 参照（毎回読む）

1. 正本: `src/content/レビュー/kuchikou-saimin-count-trip-nouiki/index.md`
2. `docs/真催眠音声執筆ガイド.md`（§1.6, §2, §3g, §3h, §3b-2, §4b, §11）
3. 対象: `src/content/レビュー/<slug>/index.md`
4. 採点根拠: 同フォルダの `_分析データ.json`（無ければユーザーに確認）
5. `.cursor/rules/review-prose-voice.mdc` / `review-audio-work-only-scoring.mdc`

## 作業手順（1 slug）

### 1. 現状把握

```bash
npm run review:audit-kansei
```

対象 slug の失敗項目をメモする。

### 2. index.md を完成系に改稿

最低限そろえるブロック:

- `circleName`（フロントマター）
- `### パートの長さ`（合計行 + `—` 区切り・`01` 連番なし。**本編のみ査定ではフルバージョン総尺を合計行に書かない** — 執筆ガイド §1（補）①）
- `**グラフ評価内訳**`（§3g・2文・`絶頂シーン`・採用されています体）
- `### 【推奨感度Lv：n以上】` + 太字グレード1行 + 感度Lvカード + **おすすめ3 / 合わない2**（`## どんな人` h2 なし）
- `## 総合評価` → `ドライシーン` / `ウェットシーン`
- 誘導・暗示表 → 3列目 `使用技法`（機序型の特性表）
- `## パート別解析`（見出しは公式名・連番だけで指さない。**本編1トラックで誘導〜快感が混在** → §3b-2 の `（誘導）`／`（深化）`／`（性感パート）`。**境界は `analysis/*.txt` の台詞**・見本 `dandan-gehin-ni-naru-saimin`）
- `## 総評：本作品の構造的結論` → 【誘導の組み立て】【快感が発生する仕組み】【結論】

おすすめ5軸は正本の3+2パターン（タイパ否定・「短時間で〜」禁止）。**第3軸**は `docs/真催眠音声執筆ガイド.md` **§2.1b**（**〇〇シチュが好きな方**・**段取り通りの催眠が好きな方 禁止**）。`index.md` の並びは誘導→フェチ→シチュ、`quickGuide.recommendedFor` は **シチュ→誘導→特徴**（§1（補）項11・§2.1b 表）。監査で `dandori_osusume` が出たら §2.1b どおり直す。

### 3. quickGuideBySlug

`src/app/(public)/reviews/[slug]/page.tsx` の `<slug>` エントリを index と同期（`recommendedLevel` / `recommendedFor` / `notRecommendedFor` / `recording`）。

### 3b. DLsite 価格（`dlsiteProductId` があるとき）

1. `data/products.json` に `id` + `url`
2. **`npm run update-price:one RJ…`**（`fetched_at` 必須。`current_price: 0` 手書き禁止）
3. **`npm run validate:dlsite-prices`**

`.cursor/rules/review-dlsite-price-placeholder.mdc` 参照。

### 4. 検査（必須）

```bash
npm run review:audit-kansei
```

対象 slug が未完了リストから消えること。`</motion>` が無いこと。

必要なら:

```bash
npm run review:audit-kansei -- --write-status
```

### 5. 完了報告

- 変更ファイル
- 推奨Lv
- ローカル URL: `http://localhost:3000/reviews/<slug>/`
- `page.tsx` 変更時は dev サーバー再起動を案内

## やってはいけないこと

- 未完了32本を1チャットで全部改稿
- 分析データを無視した星・三軸の変更
- ボーナストラック・トラック連番だけの弁明を読者本文に書く
- コミット（ユーザーが明示するまで）
