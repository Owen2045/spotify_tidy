"""
一次性擴寫腳本：為 tracks.description 填入中文描述
每次 API call 批次處理 10 首，減少請求次數
支援斷點續跑（跳過已有 description 的歌曲）

執行方式（在 nlp container 內）：
  python /tmp/enrich_descriptions.py

環境變數：
  DATABASE_URL  - PostgreSQL 連線字串
  OPENAI_API_KEY
"""
import json
import os
import time

import psycopg2
from openai import OpenAI

BATCH_SIZE = 10
COMMIT_EVERY = 50  # 每 50 首 commit 一次

DB = os.environ["DATABASE_URL"]
KEY = os.environ["OPENAI_API_KEY"]

conn = psycopg2.connect(DB)
cur = conn.cursor()
client = OpenAI(api_key=KEY)

cur.execute("SELECT COUNT(*) FROM tracks WHERE description IS NULL")
total_pending = cur.fetchone()[0]
print(f"[enrich] pending: {total_pending}", flush=True)

cur.execute("""
    SELECT t.id, t.name, t.artist_names, t.album_name, t.release_date,
           array_agg(tg.genre) FILTER (WHERE tg.genre IS NOT NULL) as genres
    FROM tracks t
    LEFT JOIN track_genres tg ON t.id = tg.track_id
    WHERE t.description IS NULL
    GROUP BY t.id, t.name, t.artist_names, t.album_name, t.release_date
    ORDER BY t.added_at DESC
""")
rows = cur.fetchall()

done = 0
batch = []

def flush_batch(batch: list) -> int:
    if not batch:
        return 0

    lines = []
    for i, (track_id, name, artists, album, release_date, genres) in enumerate(batch, 1):
        year = release_date.year if release_date else "未知"
        genre_str = ", ".join(genres) if genres else "無"
        lines.append(
            f"{i}. 歌名：{name}｜歌手：{', '.join(artists)}"
            f"｜專輯：{album or '未知'}｜年份：{year}｜曲風：{genre_str}"
        )

    prompt = (
        "你是音樂描述專家。針對以下每首歌，用繁體中文各寫一段 40-80 字的描述，"
        "涵蓋曲風氛圍、適合場景、情緒特色。\n"
        "以 JSON array 回覆，順序與輸入相同，每個元素為該歌曲的描述字串。\n\n"
        + "\n".join(lines)
    )

    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150 * len(batch),
                temperature=0.7,
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content.strip()
            parsed = json.loads(content)
            # 支援 {"descriptions": [...]} 或直接 [...]
            descs = parsed if isinstance(parsed, list) else next(iter(parsed.values()))
            break
        except Exception as e:
            if attempt == 2:
                print(f"[enrich] batch failed after 3 attempts: {e}", flush=True)
                return 0
            time.sleep(2 ** attempt)

    for (track_id, *_), desc in zip(batch, descs):
        cur.execute("UPDATE tracks SET description=%s WHERE id=%s", (str(desc), track_id))

    return len(batch)


for row in rows:
    batch.append(row)
    if len(batch) >= BATCH_SIZE:
        done += flush_batch(batch)
        batch = []
        if done % COMMIT_EVERY == 0:
            conn.commit()
            print(f"[enrich] progress: {done}/{len(rows)}", flush=True)

# 剩餘不足一批的
if batch:
    done += flush_batch(batch)

conn.commit()
print(f"[enrich] done: {done}", flush=True)
cur.close()
conn.close()
