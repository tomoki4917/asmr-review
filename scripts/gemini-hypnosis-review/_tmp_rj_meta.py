import json, re, urllib.request
url = "https://www.dlsite.com/maniax/work/=/product_id/RJ01645135.html"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "ja"})
html = urllib.request.urlopen(req, timeout=45).read().decode("utf-8")
m = re.search(r"var contents = (\{[\s\S]*?\});", html)
c = json.loads(m.group(1))
d = c["detail"][0]
print("name:", d.get("name"))
for k in ("maker_name", "brand_name", "voice_by", "author"):
    print(k, d.get(k))
vas = d.get("vas") or d.get("voice_actor") or []
print("vas", vas)
# cheerio-free: maker link
mm = re.search(r'class="maker_name"[^>]*>.*?<a[^>]*>([^<]+)</a>', html, re.S)
if mm:
    print("maker_html", mm.group(1).strip())
vm = re.findall(r'class="work_voice"[^>]*>.*?<a[^>]*>([^<]+)</a>', html, re.S)
print("voices", vm)
