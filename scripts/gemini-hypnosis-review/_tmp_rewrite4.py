from dotenv import load_dotenv
load_dotenv('.env')
import os
from pathlib import Path
from google import genai
from google.genai import types

text = "催眠ショーとメトロノームで注意を集中させ、禁止暗示と短文トリガーを重ね、約56分の逆カウント終端で乳首ドライを連発するカウント依存型。"
prompt = "次の1文を、主語や対象を省略せず、自然で短めのレビュー文に言い換えてください。禁止語: 固定し, 立ち上がる。『注意を集中させ』のような対象欠落は禁止で、必ず『注意を〇〇へ集中させる』の形にしてください。出力は1文のみ。\n\n" + text

client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])
r = client.models.generate_content(
    model=os.environ.get('GEMINI_HUMANIZE_MODEL', 'gemini-2.5-flash'),
    contents=prompt,
    config=types.GenerateContentConfig(temperature=0.2),
)
Path('_gemini_rewrite4.txt').write_text((r.text or '').strip(), encoding='utf-8')
