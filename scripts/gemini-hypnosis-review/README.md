# Gemini → B 型 `index.md` 自動執筆

**執筆・採点の運用正本:** `docs/催眠音声執筆ガイド.md`（真執筆ガイドとは別）。**ドライオーガズムと脳イキは別物**（§0.1.1・同一視禁止）。  
**採点:** `docs/催眠音声執筆ガイド.md` **§1.0 必須** — リポジトリ採点正本（`eval_system_repo.md` + 三軸定義 + 運用ガイド）+ デスクトップ3マニュアル（`HYPNOSIS_MANUAL_DIR`）。**`--eval-only` で採点のみ先に回し、§1.0 人手整合後に index へ載せる。**

## 準備

```powershell
cd scripts\gemini-hypnosis-review

## 人間味改稿（AI感の抑制）

```bash
py -3 sync_index_to_draft.py <slug>   # 任意: index → review_output 同期
py -3 humanize_prose.py <slug>
py -3 patch_humanize_to_index.py <slug>   # または humanize_prose.py --merge（中身は patch）
```

`writer_system_humanize.md` ＋ §4b 標本に寄せて `review_output.md` の散文を差し替え、**部分パッチ**で index に反映。**`auto_review.py --merge-only` の全置換は使わない**（`## パート別解析` 等が消える・§1.1）。マージが必要なときは `--merge-only --force`（**保持付き**）のみ。

**グラフ評価内訳3行だけ**

```bash
py -3 humanize_graph_breakdown.py <slug>
```

`docs/催眠音声執筆ガイド.md` §7.1 準拠。スコアは維持。やわらかくする場合は `--soft`。

**身体の変化（体内→体感）だけ戻す**

```bash
py -3 restore_body_changes.py <slug>
```

`docs/催眠音声執筆ガイド.md` §4.5 準拠（ドーパミン等のメカニズム＋`その結果、`）。`_分析データ.json` の三軸を読み、**全作品で身体の変化を採点と整合**（高評価は厚く、低評価は薄く／不足を正直に）。

**クイック「作品感想」（必須）**

```bash
py -3 generate_work_impression.py <slug> --write-tsx
```

§8.4 準拠。**【合わない可能性がある人】の直下**に出る `workImpressionParagraphs`。**`quickGuideBySlug` 登録作品は欠落不可**（Gemini で **2〜4 段落**・**AI調排除・忖度無し**のレビュアー所感）。弱点1文以上・★7以下は短所段落必須。禁止語: `芯` `手順`。構成・入り方は毎回変える（固定テンプレ・グリム型コピー・全段落称賛禁止）。見本: A=grim-grimm / B=usotsuki / C=shinri-test（低評価）。
pip install -r requirements.txt
copy .env.example .env
# .env に GEMINI_API_KEY=
```

| 入力 | 置き場所 |
|------|----------|
| 解析 SRT/TXT 等 | `--analysis-dir` → `whisper_output.txt` / `librosa_output.txt` |
| 作品メタ | 解析フォルダの `info.txt`（DLsite 確認済み） |

## 三軸採点のみ（§1.0・推奨）

```powershell
py -3 auto_review.py --eval-only `
  --slug <slug> `
  --analysis-dir "C:\path\to\解析フォルダ"
```

- `eval_results/<slug>_*.md` + `_分析データ.json` の `scores` のみ更新
- **`index.md` は触らない** → ガイド §1.0 の Cursor 人手整合 → グラフ・★ 同期

## フル生成

```powershell
py -3 auto_review.py `
  --slug <slug> `
  --item-name "作品名" `
  --circle "サークル" `
  --rj RJxxxxxx `
  --analysis-dir "C:\path\to\解析フォルダ" `
  --force
```

## 四表だけ最適化（解析データタブ）

```powershell
py -3 auto_review.py --optimize-tables --skip-eval `
  --slug <slug> --item-name "作品名" --circle "サークル" --rj RJxxxxxx `
  --analysis-dir "C:\path\to\解析フォルダ"
```

- 既存 `index.md` の **四表データ行のみ**差し替え（主要誘導・おすすめは維持）
- `_分析データ.json` に **`analysisTables`** を追記
- ルール: `docs/催眠音声執筆ガイド.md` **§3.1**

## 主要誘導の流れだけ差し替え

```powershell
py -3 auto_review.py --force --keys INDUCTION_FLOW `
  --slug <slug> --item-name "…" --circle "…" --rj RJ… `
  --analysis-dir "C:\path\to\解析フォルダ"
```

（`review_output.md` が無い場合は先にフル生成するか、既存ドラフトを置く。）

## 出力

- `src/content/レビュー/<slug>/index.md`
- `_分析データ.json`
- `review_output.md`
- `eval_results/<slug>_*.md`（採点ログ）

## リポジトリ内ファイル

| 役割 | ファイル |
|------|----------|
| **執筆正本** | `docs/催眠音声執筆ガイド.md` |
| ライター脳 | `writer_system_amatori.md` |
| 出力キー | `writer_output_keys.md` |
| **禁止語（Gemini 共通）** | `writer_forbidden.md` + `review_prose_rules.py` |
| B 型ガワ | `templates/…/index.gemini-merge.template.md` |
| 記事モード・禁止語全集 | `docs/真催眠音声執筆ガイド.md`（マージ後の人手確認用） |

## 執筆後（人手）

1. **§1.0 採点整合** … `eval_results` 確認・比較アンカー `notes`・`ratingValue`（`audit-kansei` 通過≠採点正しい）
2. `http://localhost:3000/reviews/<slug>/` で記事モード3ボタン確認
3. `py -3 scripts/generate_review_triangle.py <slug>`
4. `quickGuideBySlug`・`npm run review:validate-prose`・`npm run review:audit-kansei -- --slug <slug>`
