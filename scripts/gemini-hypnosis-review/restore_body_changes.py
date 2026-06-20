#!/usr/bin/env python3
"""主要誘導の流れ：身体の変化のみ、体内メカニズム→体感（§4.5）で Gemini 改稿。"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from auto_review import gemini_generate, get_api_key, load_file, require_api_key  # noqa: E402
from prompt_sanitize import is_sensitive_work_context, sanitize_prompt_context  # noqa: E402

load_dotenv(SCRIPT_DIR / ".env")

SYSTEM = """あなたは催眠音声レビューの編集者です。**身体の変化**行だけを書き直します。

## 作品全体の弧（必須・手順ごとに変える）
- **全手順を同じテンプレにしない**。当該手順の**引用・誘導方法**にだけ根ざした、**その場面で起きうる**身体反応を書く。
- **時系列の累積** … 手順1は導入前の平常に近い。中盤で深化・固定。快感手順は採点の快楽度まで。**解除**は満足度に合わせて再統合。
- **トランスが浅い作品（≦4）** … 何を言われても**暗示としての身体変容・催眠的快楽はほぼ起きない**。軽いリラックス・通常の興奮（実演があれば）・「言葉は聞こえるが身体は深く従わない」程度。
- **トランス中（5〜7）** … 深化は段階的。早い手順で深い固定・θ波・完全没入は書かない。
- **快楽が低い（≦5）** … **ドーパミンによる催眠的快楽・頭内絶頂・暗示だけの部位感覚は書かない**。交感優位・実演刺激・期待の高まり程度。
- **快楽が高くてもトランスが低い** … 実演・音声刺激の高揚は可。**暗示だけで脳がとろける・固定される**描写は禁止。

## 形式（厳守）
各手順ごとに:
[BODY_N]
**身体の変化:** （1〜3文・です／ます調）
[/BODY_N]

N はプロンプトで指定された件数ぶん **すべて** 出力。前置き禁止。

## 因果順（必須・メルティ標本と同型）
1. **体内メカニズム** … 副交感／交感、前頭の思考抑制、筋緊張・血流、注意の内向き、**ドーパミン**・**オキシトシン**・**エンドルフィン**・**GABA** 等（手順に合うものだけ。根拠のない羅列禁止）
2. **その結果、** … リスナーが**実際に感じる**体感（肩の脱力・頭内の締まり・全身の振動・羞恥の熱・覚醒など）

**NG:** 体感だけで終わる文（メカニズムなし）。体内と体感の順序が逆。

## 手順別の目安
- 導入・リラックス: 副交感神経優位 → 心拍・肩の脱力
- 深化・音分離・階段: 注意の内向き・前頭抑制・筋緊張低下（無理にドーパミン不要）
- 快感・EDMビート・絶頂・ライブ配信: **ドーパミン** を太字で1回以上。連続絶頂なら **エンドルフィン** も可
- 解除: 交感神経側へ戻る → 呼吸・現実感

## 禁止
くっつい、整えきれない、設計、導線、押し寄せられる、感覚がある、立ち上が、固定

## 見本（メルティ型）
**身体の変化:** ゆっくりとした呼吸が続くことで副交感神経が優位になり、覚醒系の緊張が下がります。その結果、心拍と呼吸が落ち着き、肩の力が抜けて、意識が日常のβ波からα波へと移行しやすくなります。

## 採点との整合（プロンプトに三軸があるとき・全作品・厳守）
- **身体の変化は三軸・総合評価と矛盾させない**。プロンプトの【採点】と【軸別の書き方指示】に従う。
- **高い軸** … その手順で厚く書いてよい（トランス高→深化・固定／快楽高→催眠的快楽・部位感覚／満足高→再統合・余韻）。
- **低い軸** … 薄く・不足を正直に（トランス低→浅い・固定なし／快楽低→実演寄り・催眠的快楽薄い／満足低→再統合不足・未完了感）。
- 採点が中位でも、**別軸が高いからといって低い軸を盛らない**（例: 快楽9でもトランス3なら深化は浅いまま）。
"""


def build_score_guidance(scores: dict[str, float]) -> str:
    """三軸ごとに身体の変化の厚み・禁止表現を指示（全作品）。"""
    t = scores.get("trance", 5.0)
    p = scores.get("pleasure", 5.0)
    s = scores.get("satisfaction", 5.0)
    lines = [
        "【採点（本文・グラフと一致・身体の変化は必ずこの水準と整合）】",
        f"トランス度 {t} / 快楽度 {p} / 満足度 {s}",
        "",
        "【軸別の書き方指示】",
    ]
    if t <= 2:
        lines.append(
            "- トランス極低（≦2）: 暗示はほぼ届かない。深化・固定・θ波・没入・暗示による身体変容は書かない。"
            "通常聴取・軽いリラックス・実演があれば通常の性的興奮のみ。"
        )
    elif t <= 4:
        lines.append(
            "- トランス低: 深化・固定・θ波・深い没入は書かない。浅い受容・言葉は届くが身体は深く従わない・トランス不足を可。"
        )
    elif t <= 7:
        lines.append(
            "- トランス中: 深化はあるが最深固定は控えめ。固定の厚みに限界があってよい。"
        )
    else:
        lines.append(
            "- トランス高: 前頭抑制・注意の内向き・脱力・深度持続を具体に。浅さだけで終えない。"
        )
    if p <= 3:
        lines.append(
            "- 快楽極低（≦3）: 催眠的快楽・暗示の身体感覚・頭内絶頂・トリガー報酬は書かない。"
            "何を言われても暗示としての快感は得られない。実演刺激があれば通常の興奮のみ。"
        )
    elif p <= 5:
        lines.append(
            "- 快楽低: 催眠としての心地よさ・暗示の身体感覚は薄い。交感優位・実演刺激中心を可。"
        )
    elif p <= 8:
        lines.append(
            "- 快楽中: 催眠的快楽と刺激の両方。没入の上の報酬はあるが満点型の絶頂表現は避ける。"
        )
    else:
        lines.append(
            "- 快楽高: 暗示が届く部位感覚・頭内高揚・トリガー報酬を厚く。没入の上に乗る快感を書く。"
        )
    if s <= 4:
        lines.append(
            "- 満足低: 解除で再統合不足・興奮残存・未完了感を可。「すっきり完全覚醒」だけで締めない。"
        )
    elif s <= 7:
        lines.append(
            "- 満足中: 覚醒誘導は明確だが余韻はやや短めと可。"
        )
    else:
        lines.append(
            "- 満足高: 再統合・現実感回復・余韻まで丁寧に。"
        )
    lines.append(
        "- 他軸が高くても低い軸を盛らない（例: 快楽9でもトランス3なら深化は浅い・暗示快楽は薄い）。"
    )
    if t <= 4 and p <= 5:
        lines.append(
            "- **トランス低×快楽低**: 全手順を通し、暗示による快感・固定・脳内絶頂は原則書かない。"
            "手順が快感区間でも「実演・想像の通常反応」に留める。"
        )
    elif t <= 4 and p >= 7:
        lines.append(
            "- **トランス低×快楽高**: 快感は**実演・音声刺激・シチュ**中心。"
            "「暗示が身体を書き換える」「言葉だけで深くとろける」は書かない。"
        )
    return "\n".join(lines) + "\n\n"


def step_arc_hint(step_n: int, total: int, title: str) -> str:
    """手順位置と役割から、作品全体の弧上の書き方を指示。"""
    n = int(step_n)
    t = total
    if "解除" in title or "覚醒" in title:
        return "終盤・解除: 再統合・現実感回復・余韻（満足度に合わせる）。"
    if n == 1:
        return "導入: 平常に近い。これから深まる余地を残す。早い段階で深い固定・絶頂は書かない。"
    if n == 2:
        return "序盤: リラックス・注意の内向き開始。まだ浅い。"
    if n >= t - 1 and t >= 5:
        return "終盤手前〜クライマックス付近: 作品のピーク手順。採点の快楽・トランス上限まで。"
    if n <= max(2, t // 3):
        return "前半: 深化の途中。採点トランスの上限より一段浅く書いてよい。"
    return "中盤: 採点に見合う深化・快感へ段階的に。前後手順と同文を避ける。"


def abstract_method_hint(title: str, scores: dict[str, float] | None) -> str:
    """API プロンプト用：手順種別＋三軸に応じた生理・催眠要点。"""
    t = (scores or {}).get("trance", 5.0)
    p = (scores or {}).get("pleasure", 5.0)
    s = (scores or {}).get("satisfaction", 5.0)

    if "注意" in title or "ルール" in title:
        base = "ルール説明で注意が内向き。"
        if t <= 4:
            return base + "深化・固定はこれからほぼ行わない。"
        if t >= 8:
            return base + "以降の深化・固定へつながる受容の土台。"
        return base + "以降の深化の深さは採点のトランス水準に合わせる。"

    if "呼吸" in title:
        if t <= 4:
            return "短い呼吸誘導。副交感は軽く優位。深いトランスには至らない。"
        if t >= 8:
            return "呼吸誘導で副交感優位。前頭抑制・脱力・α波移行しやすい。"
        return "呼吸誘導で副交感が優位。深化は採点のトランス水準まで。"

    if "想像" in title or "禁止" in title or "カリギュラ" in title:
        if t <= 4 and p <= 5:
            return "想像・禁止反転。トランス浅く欲求・興奮が主。催眠的快楽は薄い。"
        if t >= 7 and p >= 8:
            return "想像・トリガー導入。注意の内向きと催眠的快楽の土台を厚く。"
        return "想像・禁止反転。トランス・快楽は各採点に合わせる。"

    if any(k in title for k in ("手コキ", "フェラ", "中出し", "お仕置き", "射精", "セックス")):
        if p <= 5:
            return "実演・禁止反復区間。交感優位・性的興奮。催眠的快楽・没入の上の報酬は薄い。"
        if p >= 9:
            return "快感・絶頂区間。ドーパミン・部位感覚・頭内高揚。没入の上の報酬を厚く。"
        return "快感区間。交感・ドーパミンと催眠的快楽の比率は快楽採点に合わせる。"

    if "解除" in title or "覚醒" in title:
        if s <= 4:
            return "催眠解除。再統合不足・興奮残存・未完了感が残りやすい。"
        if s >= 8:
            return "催眠解除・覚醒誘導。再統合・現実感回復・余韻まで丁寧。"
        return "催眠解除。覚醒と再統合の厚みは満足採点に合わせる。"

    return "当該手順。三軸スコアと矛盾しない体内→体感で書く。"


def extract_steps(index_md: str) -> list[dict[str, str]]:
    m = re.search(
        r"### 主要誘導の流れ.*?(?=\n---\s*\n\s*\n## 総評)",
        index_md,
        re.DOTALL,
    )
    if not m:
        return []
    section = m.group(0)
    steps: list[dict[str, str]] = []
    for block in re.split(r"\n#### ", section):
        if not re.match(r"\d+\.", block.strip()):
            continue
        title_m = re.match(r"(\d+)\.\s+(.+?)\n", block)
        quote_m = re.search(r"^>\s*(.+)", block, re.MULTILINE)
        method_m = re.search(r"\*\*誘導方法:\*\*\s*(.+)", block)
        body_m = re.search(r"\*\*身体の変化:\*\*\s*(.+)", block, re.DOTALL)
        if title_m and method_m and body_m:
            steps.append(
                {
                    "n": title_m.group(1),
                    "title": title_m.group(2).strip(),
                    "quote": quote_m.group(1).strip()[:200] if quote_m else "",
                    "method": method_m.group(1).strip(),
                    "body": body_m.group(1).strip().split("\n\n")[0],
                }
            )
    return steps


def parse_bodies(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in re.finditer(r"\[BODY_(\d+)\]\s*\n(.*?)\[/BODY_\1\]", text, re.DOTALL):
        body = m.group(2).strip()
        if not body.startswith("**身体の変化:**"):
            body = "**身体の変化:** " + body.lstrip("*身体の変化:* ").strip()
        out[m.group(1)] = body
    return out


def load_scores(slug: str) -> dict[str, float] | None:
    json_path = ROOT / "src" / "content" / "レビュー" / slug / "_分析データ.json"
    if not json_path.is_file():
        return None
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    scores = data.get("scores")
    if not isinstance(scores, dict):
        return None
    out: dict[str, float] = {}
    for key in ("trance", "pleasure", "satisfaction"):
        if key in scores and scores[key] is not None:
            out[key] = float(scores[key])
    return out or None


def write_compare_file(
    slug: str, steps: list[dict[str, str]], bodies: dict[str, str]
) -> Path:
    out_path = SCRIPT_DIR / f"body_compare_{slug}.md"
    lines = [f"# 身体の変化 比較: {slug}\n", "手編集（実行前） vs Gemini（今回）\n"]
    for s in steps:
        n = s["n"]
        lines.append(f"## 手順{n}: {s['title']}\n")
        lines.append("### 手編集（変更前）\n")
        lines.append(f"{s['body']}\n")
        lines.append("### Gemini\n")
        lines.append(bodies.get(n, "（なし）").replace("**身体の変化:** ", "") + "\n")
        lines.append("---\n")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("slug")
    p.add_argument(
        "--compare-only",
        action="store_true",
        help="index.md は更新せず body_compare_<slug>.md に差分だけ出力",
    )
    args = p.parse_args()

    index_path = ROOT / "src" / "content" / "レビュー" / args.slug / "index.md"
    index_md = index_path.read_text(encoding="utf-8")
    steps = extract_steps(index_md)
    n_steps = len(steps)
    if n_steps < 5 or n_steps > 8:
        print(f"[エラー] 手順は5〜8件想定ですが {n_steps} 件抽出されました")
        sys.exit(1)

    guide_excerpt = load_file(ROOT / "docs" / "催眠音声執筆ガイド.md", "guide")
    guide_45 = ""
    if "### 4.5 身体の変化" in guide_excerpt:
        guide_45 = guide_excerpt.split("### 4.5 身体の変化", 1)[1].split("### 4.6", 1)[0]

    scores = load_scores(args.slug)
    score_block = build_score_guidance(scores) if scores else (
        "【採点】_分析データ.json なし。index.md のグラフ評価内訳3行の数値と整合させること。\n\n"
    )

    prompt_parts = [
        f"【執筆ルール抜粋】\n{guide_45}\n",
        score_block,
        f"【{n_steps}手順・現状】\n",
    ]
    require_api_key()
    model = os.environ.get("GEMINI_HUMANIZE_MODEL", "gemini-2.5-flash")
    client = genai.Client(api_key=get_api_key())
    bodies: dict[str, str] = {}
    batch_size = int(os.environ.get("BODY_CHANGE_BATCH", "4"))

    for start in range(0, n_steps, batch_size):
        chunk = steps[start : start + batch_size]
        nums = [s["n"] for s in chunk]
        prompt_parts = [
            f"【執筆ルール抜粋】\n{guide_45}\n",
            score_block,
            f"【手順 {', '.join(nums)} / 全{n_steps}】\n",
        ]
        for s in chunk:
            arc = step_arc_hint(int(s["n"]), n_steps, s["title"])
            quote = sanitize_prompt_context(s["quote"] or "（なし）")
            method = sanitize_prompt_context(s["method"])
            title = sanitize_prompt_context(s["title"])
            prompt_parts.append(
                f"### 手順{s['n']}: {title}\n"
                f"作品内位置: {arc}\n"
                f"引用（当該場面・API向け婉曲語）: {quote}\n"
                f"誘導方法: {method}\n"
                f"生理・催眠上の要点: {abstract_method_hint(s['title'], scores)}\n"
            )
        prompt_parts.append(
            f"\n手順 {', '.join(nums)} の [BODY_N]…[/BODY_N] のみ出力（N={nums[0]}〜{nums[-1]}）。"
            "\n【注意】引用・誘導方法はAPI向けに婉曲語化済み。"
            "出力の**身体の変化**は元の意味（催眠・快感・変容）に合わせること。"
        )
        prompt = "\n".join(prompt_parts)
        system = SYSTEM.replace(
            "N はプロンプトで指定された件数ぶん **すべて** 出力。",
            f"N は {nums[0]}〜{nums[-1]}。**{len(chunk)}件すべて**出力。",
        )
        print(f"[body] Gemini ({model}) ... steps {nums[0]}-{nums[-1]}")
        out = gemini_generate(
            client,
            model=model,
            contents=prompt,
            system_instruction=system,
            temperature=0.2,
            label="身体の変化",
            fallback_contents=sanitize_prompt_context(prompt, aggressive=True),
        )
        if not (out or "").strip():
            print("[エラー] Gemini が空応答を返しました（API キー・クォータを確認）")
            sys.exit(1)
        part = parse_bodies(out)
        if len(part) != len(chunk):
            debug = SCRIPT_DIR / f"_body_debug_{args.slug}_{nums[0]}.txt"
            debug.write_text(out, encoding="utf-8")
            print(f"[エラー] パース失敗 ({len(part)}/{len(chunk)}) → {debug}")
            sys.exit(1)
        bodies.update(part)

    if len(bodies) != n_steps:
        print(f"[エラー] 合計パース失敗 ({len(bodies)}/{n_steps})")
        sys.exit(1)

    compare_path = write_compare_file(args.slug, steps, bodies)
    print(f"[body] 比較ファイル: {compare_path}")

    if args.compare_only:
        print("[body] --compare-only のため index.md は未更新")
        return

    new_md = index_md
    for s in steps:
        old_body_line = f"**身体の変化:** {s['body']}"
        new_body = bodies[s["n"]]
        if old_body_line not in new_md:
            print(f"[警告] 手順{s['n']} の置換失敗")
            continue
        new_md = new_md.replace(old_body_line, new_body, 1)

    index_path.write_text(new_md, encoding="utf-8")
    print(f"[body] 更新: {index_path}")
    for n in sorted(bodies, key=int):
        print(f"\n--- {n} ---\n{bodies[n][:160]}…")


if __name__ == "__main__":
    main()
