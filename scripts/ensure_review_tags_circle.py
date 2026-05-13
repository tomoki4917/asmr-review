# -*- coding: utf-8 -*-
"""Add circle name from ##作品概要 to frontmatter tags if missing."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src" / "content" / "レビュー"
CIRCLE_RE = re.compile(r"^-\s*\*\*サークル：\*\*\s*(.+?)\s*$", re.MULTILINE)


def extract_circle(text: str) -> str | None:
    m = CIRCLE_RE.search(text)
    return m.group(1).strip() if m else None


def parse_frontmatter(md: str) -> tuple[str | None, str]:
    if not md.startswith("---"):
        return None, md
    end = md.find("\n---", 3)
    if end == -1:
        return None, md
    return md[3:end], md[end + 4 :]


def parse_tags(fm: str) -> list[str]:
    tags: list[str] = []
    in_tags = False
    for line in fm.splitlines():
        if line.strip().startswith("tags:"):
            in_tags = True
            continue
        if in_tags:
            if line.startswith("  - "):
                tags.append(line[4:].strip())
            elif line.strip() and not line.startswith(" "):
                break
    return tags


def replace_tags_block(fm: str, new_tags: list[str]) -> str:
    lines = fm.splitlines()
    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("tags:"):
            out.append("tags:")
            for t in new_tags:
                out.append(f"  - {t}")
            i += 1
            while i < len(lines) and lines[i].startswith("  - "):
                i += 1
            continue
        out.append(line)
        i += 1
    return "\n".join(out) + ("\n" if fm.endswith("\n") else "")


def circle_covered(circle: str, tags: list[str]) -> bool:
    c = circle.strip()
    c_short = c.split("（")[0].strip()
    for t in tags:
        t = t.strip()
        if t in (c, c_short):
            return True
        if len(t) >= 2 and (c.startswith(t) or c_short.startswith(t)):
            return True
        if len(t) >= 3 and (t in c or t in c_short):
            return True
    return False


def tag_value_for_yaml(circle: str) -> str:
    """Short primary name before first fullwidth paren (matches site tag style)."""
    s = circle.split("（")[0].strip()
    return s if s else circle.strip()


def main() -> None:
    changed: list[str] = []
    skipped: list[tuple[str, str]] = []

    for p in sorted(ROOT.glob("*/index.md")):
        if p.parent.name.startswith("_"):
            continue
        raw = p.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(raw)
        if fm is None:
            skipped.append((p.parent.name, "no frontmatter"))
            continue
        circle = extract_circle(raw)
        if not circle:
            skipped.append((p.parent.name, "no circle line"))
            continue
        tags = parse_tags(fm)
        if not tags:
            skipped.append((p.parent.name, "no tags"))
            continue
        if circle_covered(circle, tags):
            continue
        tag_val = tag_value_for_yaml(circle)
        new_tags = list(tags)
        if "催眠音声" in new_tags:
            new_tags.insert(new_tags.index("催眠音声") + 1, tag_val)
        else:
            new_tags.insert(0, tag_val)
        new_fm = replace_tags_block(fm, new_tags)
        p.write_text("---\n" + new_fm + "---" + body, encoding="utf-8")
        changed.append(p.parent.name)

    print("UPDATED", len(changed))
    for s in changed:
        print(" ", s)
    print("SKIPPED", len(skipped))
    for s, r in skipped:
        print(" ", s, r)


if __name__ == "__main__":
    main()
