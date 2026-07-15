# -*- coding: utf-8 -*-
"""記事フロントマターを「投稿日未定・読者非表示」に揃える。"""
from __future__ import annotations

import re
from pathlib import Path

DRAFT_GO_LIVE = "2099-12-31T12:00:00+09:00"


def apply_draft_visibility(
    index_md: str,
    *,
    go_live_at: str = DRAFT_GO_LIVE,
    exclude_from_index: bool = True,
    omit_published_at: bool = True,
) -> str:
    """
    - publishedAt を削除（投稿日未定 → 一覧・サイトマップ非表示）
    - goLiveAt を遠い未来に（本番ビルドでも非表示）
    - excludeFromReviewIndex: true（内部下書き）

    執筆者は `npm run dev` で一覧（下書きバッジ）・詳細を確認できる。
    """
    text = index_md.replace("\r\n", "\n")
    if not text.startswith("---\n"):
        raise ValueError("フロントマターが見つかりません")

    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("フロントマター終端が見つかりません")
    fm = text[4:end]
    body = text[end + 5 :]

    lines = fm.split("\n")
    out: list[str] = []
    saw_golive = False
    saw_exclude = False
    for line in lines:
        if re.match(r"^publishedAt\s*:", line):
            if omit_published_at:
                continue
            out.append(line)
            continue
        if re.match(r"^goLiveAt\s*:", line):
            out.append(f'goLiveAt: "{go_live_at}"')
            saw_golive = True
            continue
        if re.match(r"^excludeFromReviewIndex\s*:", line):
            if exclude_from_index:
                out.append("excludeFromReviewIndex: true")
                saw_exclude = True
            continue
        out.append(line)

    insert_at = len(out)
    for i, line in enumerate(out):
        if re.match(r"^saleDate\s*:", line):
            insert_at = i + 1
            break

    extras: list[str] = []
    if not saw_golive:
        extras.append(f'goLiveAt: "{go_live_at}"')
    if exclude_from_index and not saw_exclude:
        extras.append("excludeFromReviewIndex: true")
    if extras:
        out[insert_at:insert_at] = extras

    return "---\n" + "\n".join(out) + "\n---\n" + body


def patch_index_file(path: Path, **kwargs) -> None:
    raw = path.read_text(encoding="utf-8")
    path.write_text(apply_draft_visibility(raw, **kwargs), encoding="utf-8")
