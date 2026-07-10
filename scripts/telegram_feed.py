"""
Compass scholarship feed collector.
Reads new posts from a list of public Telegram scholarship channels and
inserts them into the Supabase `scholarship_feed` table.

Setup (one time):
  pip install telethon requests
  1) Get Telegram API credentials at https://my.telegram.org (API ID + hash)
  2) Set env vars: TG_API_ID, TG_API_HASH, SUPABASE_URL, SUPABASE_SERVICE_KEY
  3) First run asks for your phone + code, then saves a session file.
Run on a schedule (e.g. GitHub Actions cron every 30 min, or any small server).
"""
import os, re, requests
from telethon.sync import TelegramClient

CHANNELS = [
    # add up to 100 public channel usernames here:
    "scholarships_uz", "daad_scholarships", "chevening_uz",
]
KEYWORDS = re.compile(r"scholar|grant|stipend|fully funded|tuition", re.I)

api_id = int(os.environ["TG_API_ID"]); api_hash = os.environ["TG_API_HASH"]
SB_URL = os.environ["SUPABASE_URL"]; SB_KEY = os.environ["SUPABASE_SERVICE_KEY"]

def push(row):
    r = requests.post(f"{SB_URL}/rest/v1/scholarship_feed",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}",
                 "Content-Type": "application/json", "Prefer": "resolution=ignore-duplicates"},
        json=row, timeout=15)
    print(row["title"][:50], r.status_code)

with TelegramClient("compass_feed", api_id, api_hash) as client:
    for ch in CHANNELS:
        try:
            for msg in client.iter_messages(ch, limit=10):
                text = (msg.message or "").strip()
                if not text or not KEYWORDS.search(text):
                    continue
                title = text.split("\n")[0][:180]
                push({"title": title, "source": ch,
                      "url": f"https://t.me/{ch}/{msg.id}",
                      "posted_at": msg.date.isoformat()})
        except Exception as e:
            print("skip", ch, e)
