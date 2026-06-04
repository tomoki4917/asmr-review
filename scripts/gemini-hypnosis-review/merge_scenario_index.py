#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gemini review_output [KEY] → シチュボイス index.md"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
sys.path.insert(0, str(SCRIPT_DIR))

from auto_review import format_sale_date_display_jp, indent_yaml_block, parse_gemini_keys  # noqa: E402
from review_prose_rules import validate_index_md  # noqa: E402

REVIEWS_DIR = ROOT / "src" / "content" / "レビュー"


def orgasm_line(count: str) -> str:
    c = (count or "").strip()
    if not c or c == "0":
        return "絶頂シーン複数回"
    if "複数" in c:
        return "絶頂シーン複数回"
    return f"絶頂シーン{int(float(c))}回"


def resolve_cover_image(slug: str, rj: str) -> str:
    """analysis/info.txt の img パスから親 RJ を取得（誤った RJ0xx000 推測を避ける）。"""
    info = REVIEWS_DIR / slug / "analysis" / "info.txt"
    if info.is_file():
        m = re.search(
            rf"modpub/images2/work/doujin/(RJ\d+)/{re.escape(rj)}_img_main",
            info.read_text(encoding="utf-8"),
        )
        if m:
            parent = m.group(1)
            return (
                f"https://img.dlsite.jp/modpub/images2/work/doujin/"
                f"{parent}/{rj}_img_main.jpg"
            )
    return f"https://img.dlsite.jp/modpub/images2/work/doujin/{rj}/{rj}_img_main.jpg"


def format_audience_list_items(pairs: list[tuple[str, str]]) -> str:
    """催眠 B 型と同型: `- **ラベル**` + 改行 + 理由（項目間は空行）。"""
    blocks: list[str] = []
    for label, reason in pairs:
        lb = label.strip()
        if not lb:
            continue
        rs = reason.strip()
        blocks.append(f"- **{lb}**  \n  {rs}" if rs else f"- **{lb}**")
    return "\n\n".join(blocks)


def package_to_table(raw: str) -> str:
    rows: list[str] = []
    for line in raw.splitlines():
        m = re.match(r"^-\s+\*\*(.+?)\*\*\s*[…\.]{1,3}\s*\*\*(\d{1,2}:\d{2})\*\*", line.strip())
        if m:
            rows.append(f"| {len(rows) + 1} | {m.group(1)} | {m.group(2)} |")
    if not rows:
        return raw.strip()
    return (
        "| # | 公式トラック名 | 尺 |\n|---|----------------|-----|\n" + "\n".join(rows)
    )


def assemble(
    keys: dict[str, str],
    *,
    slug: str,
    item_name: str,
    circle: str,
    rj: str,
    sale_date: str,
    published_at: str,
    go_live_at: str,
    all_ages: bool = False,
) -> str:
    rj = rj.upper()
    title = item_name.replace("【レビュー】", "").strip()
    cover_image = resolve_cover_image(slug, rj)
    rating = keys.get("RATING_VALUE", "9").strip()
    sale_disp = keys.get("SALE_DATE_DISPLAY") or format_sale_date_display_jp(sale_date)
    cv = keys.get("CV_MALE", "").strip()
    cv_f = keys.get("CV_FEMALE", "").strip()
    if cv_f:
        cv = f"{cv} / {cv_f}" if cv else cv_f
    tags = keys.get("TAGS_YAML", "").strip()
    if tags and not tags.lstrip().startswith("-"):
        tags = "- " + tags.replace("\n", "\n  - ")
    rec_pairs: list[tuple[str, str]] = []
    for i in range(1, 4):
        lb = keys.get(f"RECOMMENDED_{i}", "").strip()
        rs = keys.get(f"RECOMMENDED_{i}_REASON", "").strip()
        if lb:
            rec_pairs.append((lb, rs))
    ng_pairs: list[tuple[str, str]] = []
    for i in range(1, 3):
        lb = keys.get(f"NOT_RECOMMENDED_{i}", "").strip()
        rs = keys.get(f"NOT_RECOMMENDED_{i}_REASON", "").strip()
        if lb:
            ng_pairs.append((lb, rs))
    rec_md = format_audience_list_items(rec_pairs)
    ng_md = format_audience_list_items(ng_pairs)
    go = f'goLiveAt: "{go_live_at}"\n' if go_live_at else ""
    ill = keys.get("ILLUSTRATOR", "").strip()
    basic_extra = f"- **イラスト：** {ill}\n" if ill else ""
    genre = keys.get("GENRE_TYPE", "同人音声").strip()
    pkg = package_to_table(keys.get("PACKAGE_FILES", ""))

    graph_axes = (
        "没入度・シナリオ・睡眠・覚醒・音響・満足度"
        if all_ages
        else "没入度・シナリオ・快楽度・音響・満足度"
    )
    orgasm_block = (
        ""
        if all_ages
        else f"\n{orgasm_line(keys.get('ORGASM_SCENE_COUNT', ''))}\n"
    )

    return f"""---
slug: {slug}
title: 【レビュー】{title}
summary: |
{indent_yaml_block(keys.get("SUMMARY", "").strip(), 2)}
tags:
{tags or "  - 同人音声"}
ratingValue: {rating}
ratingBest: 10
itemName: {title}
itemDescription: |
{indent_yaml_block(keys.get("ITEM_DESCRIPTION", "").strip(), 2)}
authorName: 同人音声レビュー室
circleName: {circle}
saleDate: "{sale_date}"
publishedAt: "{published_at}"
{go}coverImage: {cover_image}
coverAffiliateHref: https://dlaf.jp/maniax/dlaf/=/t/i/link/work/aid/reviewLab/id/{rj}.html
affiliateLinks:
  - vendor: dlsite
    href: https://dlaf.jp/maniax/dlaf/=/t/n/link/work/aid/reviewLab/id/{rj}.html
    label: 体験版はこちら
dlsiteProductId: {rj}
---

## 作品名

**{title}**

---

## 作品概要

### 基本情報

- **サークル：** {circle}
- **販売日：** {sale_disp}
- **種類：** {genre}
- **声優：** {cv}
{basic_extra}
### パートの長さ

{pkg}

## 作品評価グラフ

![作品評価グラフ（{graph_axes}）](/content/reviews/{slug}/review_triangle.png)

**グラフ評価内訳**

{keys.get("GRAPH_BREAKDOWN", "").strip()}

**【こんな人におすすめ】**

{rec_md}

**【合わない可能性がある人】**

{ng_md}

---

## 総合評価

**★{rating} / 10**
{orgasm_block}

## 総評：本作品の結論

{keys.get("CONCLUSION_DESIGN", "").strip()}

{keys.get("CONCLUSION_ACOUSTIC", "").strip()}

{keys.get("CONCLUSION_FINAL", "").strip()}
"""


def sync_analysis(path: Path, keys: dict[str, str], work: str, *, all_ages: bool = False) -> None:
    def sc(k: str, fb: float) -> float:
        try:
            return round(float(keys.get(k, fb)), 1)
        except (TypeError, ValueError):
            return fb

    data = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {"schemaVersion": 2, "notes": []}
    data["schemaVersion"] = 2
    data["workName"] = work
    data["scores"] = {
        "immersion": sc("SCORE_IMMERSION", 9),
        "scenario": sc("SCORE_SCENARIO", 9),
        "pleasure": sc("SCORE_PLEASURE", 9),
        "acoustic": sc("SCORE_ACOUSTIC", 9),
        "satisfaction": sc("SCORE_SATISFACTION", 9),
    }
    org = keys.get("ORGASM_SCENE_COUNT", "")
    if not all_ages:
        if org and "複数" in org:
            data["orgasmSummary"] = "絶頂シーン複数回"
        elif org and org not in ("0", ""):
            try:
                data["orgasmSummary"] = f"絶頂シーン{int(float(org))}回"
            except ValueError:
                pass
    if all_ages:
        data["radarAxisLabels"] = {"pleasure": "睡眠・覚醒"}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("slug")
    p.add_argument("--item-name", required=True)
    p.add_argument("--circle", required=True)
    p.add_argument("--rj", required=True)
    p.add_argument("--sale-date", required=True)
    p.add_argument("--published-at", required=True)
    p.add_argument("--go-live-at", default="")
    p.add_argument(
        "--all-ages",
        action="store_true",
        help="全年齢（絶頂行なし・グラフ alt 睡眠・覚醒・radarAxisLabels）",
    )
    args = p.parse_args()

    draft = SCRIPT_DIR / "review_output.md"
    keys = parse_gemini_keys(draft.read_text(encoding="utf-8"))
    all_ages = args.all_ages or bool(
        re.search(r"^\s*-\s+全年齢同人\s*$", keys.get("TAGS_YAML", ""), re.MULTILINE)
    )
    for req in ("SUMMARY", "GRAPH_BREAKDOWN"):
        if not keys.get(req, "").strip():
            print(f"[エラー] 必須キー不足: {req}")
            sys.exit(1)

    out = REVIEWS_DIR / args.slug / "index.md"
    md = assemble(
        keys,
        slug=args.slug,
        item_name=args.item_name,
        circle=args.circle,
        rj=args.rj,
        sale_date=args.sale_date,
        published_at=args.published_at,
        go_live_at=args.go_live_at,
        all_ages=all_ages,
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(md, encoding="utf-8")
    sync_analysis(out.parent / "_分析データ.json", keys, args.item_name, all_ages=all_ages)
    print(f"[完了] {out}")


if __name__ == "__main__":
    main()
