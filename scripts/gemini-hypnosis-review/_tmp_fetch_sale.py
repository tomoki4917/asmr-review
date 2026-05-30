import re
import urllib.request

url = "https://www.dlsite.com/maniax/work/=/product_id/RJ01506610.html"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
for pat in [
    r'"regist_date"\s*:\s*"(\d{4}-\d{2}-\d{2})"',
    r'"sales_date"\s*:\s*"(\d{4}-\d{2}-\d{2})"',
    r'"work_sales_date"\s*:\s*"(\d{4}-\d{2}-\d{2})"',
]:
    for m in re.finditer(pat, html):
        print(pat, m.group(1))
