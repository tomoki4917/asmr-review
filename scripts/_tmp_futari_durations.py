import json
import glob
import os

base = r"c:\Users\tomok\Desktop\解析後\投稿完了\ふたりがけ催眠メルティオーガズム編"
for p in sorted(glob.glob(os.path.join(base, "*.json"))):
    with open(p, encoding="utf-8") as f:
        d = json.load(f)
    segs = d.get("segments", [])
    if not segs:
        print(os.path.basename(p), "no segments")
        continue
    end = float(segs[-1]["end"])
    m = int(end // 60)
    s = end - m * 60
    print(f"{os.path.basename(p)}\t{m}:{s:05.2f}\t{end:.1f}s")
