#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""merge 後の後処理を一括実行（品質チェック込み）。"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
REVIEWS_DIR = ROOT / "src" / "content" / "レビュー"


def run(cmd: list[str], *, label: str, optional: bool = False) -> bool:
    print(f"\n>> {label}")
    print(f"  $ {' '.join(cmd)}")
    r = subprocess.run(cmd, cwd=str(ROOT))
    if r.returncode != 0:
        msg = f"[{'警告' if optional else 'エラー'}] {label} が失敗 (exit {r.returncode})"
        print(msg)
        if not optional:
            return False
    return True


def run_review_ship(
    slug: str,
    *,
    skip_restore: bool = False,
    skip_impression: bool = False,
    skip_triangle: bool = False,
    skip_audit: bool = False,
) -> bool:
    """後処理一括。成功 True / 失敗 False。"""
    index_path = REVIEWS_DIR / slug / "index.md"
    if not index_path.is_file():
        print(f"[エラー] index.md がありません: {index_path}")
        return False

    py = sys.executable

    if not skip_triangle:
        tri = ROOT / "scripts" / "generate_review_triangle.py"
        if tri.is_file() and (REVIEWS_DIR / slug / "_分析データ.json").is_file():
            if not run([py, str(tri), slug], label="review_triangle.png"):
                return False

    if not skip_restore:
        restore = SCRIPT_DIR / "restore_body_changes.py"
        if restore.is_file():
            if not run([py, str(restore), slug], label="身体の変化（§4.5）"):
                return False

    if not skip_impression:
        imp = SCRIPT_DIR / "generate_work_impression.py"
        if imp.is_file():
            if not run([py, str(imp), slug, "--write-tsx"], label="workImpressionParagraphs"):
                return False

    if not run(
        [py, str(SCRIPT_DIR / "review_prose_rules.py"), "--slug", slug],
        label="禁止語 validate-prose",
    ):
        return False

    if not skip_audit:
        run(
            ["npm", "run", "review:audit-scenario", "--", slug],
            label="シナリオ監査",
            optional=True,
        )
        if not run(
            ["npm", "run", "review:audit-kansei", "--", "--slug", slug],
            label="完成系監査 audit-kansei",
        ):
            return False

    if not run(
        ["npm", "run", "sync:content-assets"],
        label="public/content へ画像ミラー（review_triangle 等）",
    ):
        return False

    print("\n【review:ship 完了】")
    print(f"  {index_path}")
    return True


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="催眠レビュー merge 後の後処理一括")
    p.add_argument("--slug", required=True)
    p.add_argument(
        "--skip-restore",
        action="store_true",
        help="restore_body_changes.py をスキップ（Gemini API 不要）",
    )
    p.add_argument(
        "--skip-impression",
        action="store_true",
        help="generate_work_impression.py をスキップ",
    )
    p.add_argument(
        "--skip-triangle",
        action="store_true",
        help="review_triangle.png 再生成をスキップ",
    )
    p.add_argument(
        "--skip-audit",
        action="store_true",
        help="audit-scenario / audit-kansei をスキップ",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    ok = run_review_ship(
        args.slug,
        skip_restore=args.skip_restore,
        skip_impression=args.skip_impression,
        skip_triangle=args.skip_triangle,
        skip_audit=args.skip_audit,
    )
    if ok:
        print("  残り（人手）: quickGuideBySlug・scenario-facts.json（未作成時）")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
