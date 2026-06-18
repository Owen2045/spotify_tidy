"""
Spotify API 探索腳本

執行前需啟動 SSH tunnel：
  ssh -L 5432:127.0.0.1:5432 -L 8001:127.0.0.1:8001 owen@10.16.43.111

安裝依賴（venv 已在根目錄）：
  pip install python-dotenv psycopg2-binary requests
"""

import json
import sys
from pathlib import Path

import psycopg2
import requests
from dotenv import dotenv_values

# ── 設定 ──────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent
env = dotenv_values(ROOT / "deploy" / ".env.dev")

DB_DSN = (
    f"host=localhost port=5432"
    f" dbname={env['POSTGRES_DB']}"
    f" user={env['POSTGRES_USER']}"
    f" password={env['POSTGRES_PASSWORD']}"
)
AUTH_URL = "http://localhost:8001"


# ── 工具函式 ──────────────────────────────────────────────

def pprint(data: dict) -> None:
    print(json.dumps(data, indent=2, ensure_ascii=False))


def get_access_token() -> str:
    conn = psycopg2.connect(DB_DSN)
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM spotify_tokens LIMIT 1")
    row = cur.fetchone()
    conn.close()

    if not row:
        print("DB 裡沒有已連結 Spotify 的用戶", file=sys.stderr)
        sys.exit(1)

    user_id = row[0]
    resp = requests.get(f"{AUTH_URL}/auth/internal/token/{user_id}", timeout=5)
    resp.raise_for_status()
    return resp.json()["access_token"]


def spotify(token: str, path: str, params: dict = None):
    resp = requests.get(
        f"https://api.spotify.com/v1{path}",
        headers={"Authorization": f"Bearer {token}"},
        params=params,
        timeout=10,
    )
    return resp.status_code, resp.json()


# ── 主程式 ────────────────────────────────────────────────

def main():
    print("取得 access token...")
    token = get_access_token()
    print("OK\n")

    # 1. 取一首收藏歌曲
    print("=" * 50)
    print("1. 收藏歌曲（liked tracks，取 1 首）")
    print("=" * 50)
    status, data = spotify(token, "/me/tracks", {"limit": 1})
    total = data.get("total", "?")
    print(f"狀態: {status}  總收藏數: {total}\n")

    if status != 200 or not data.get("items"):
        print("無法取得收藏歌曲")
        return

    item = data["items"][0]
    track = item["track"]
    track_id = track["id"]
    artist_id = track["artists"][0]["id"]

    print("Track 物件結構（只保留我們會用的欄位）:")
    pprint({
        "id":          track["id"],
        "name":        track["name"],
        "artists":     [{"id": a["id"], "name": a["name"]} for a in track["artists"]],
        "album":       {"name": track["album"]["name"], "release_date": track["album"]["release_date"]},
        "popularity":  track["popularity"],
        "duration_ms": track["duration_ms"],
        "explicit":    track["explicit"],
        "added_at":    item["added_at"],
    })

    # 2. Audio features（預期 403，但確認一下）
    print("\n" + "=" * 50)
    print(f"2. Audio Features（track: {track_id}）")
    print("=" * 50)
    status, data = spotify(token, f"/audio-features/{track_id}")
    print(f"狀態: {status}")
    if status == 200:
        pprint(data)
    else:
        print("403 = 此 app 無法使用 audio features API（Spotify 已停用）")

    # 3. Artist（拿 genres）
    print("\n" + "=" * 50)
    print(f"3. Artist（id: {artist_id}）")
    print("=" * 50)
    status, data = spotify(token, f"/artists/{artist_id}")
    print(f"狀態: {status}")
    pprint({
        "id":       data.get("id"),
        "name":     data.get("name"),
        "genres":   data.get("genres"),
        "popularity": data.get("popularity"),
    })

    # 4. 批次取 artists（實際 sync 會用到）
    print("\n" + "=" * 50)
    print("4. 批次取 Artists（最多 50 個 ID，實際 sync 用法）")
    print("=" * 50)
    status, data = spotify(token, "/artists", {"ids": artist_id})
    print(f"狀態: {status}  回傳藝術家數: {len(data.get('artists', []))}")

    # 5. 確認總收藏數
    print("\n" + "=" * 50)
    print("5. 收藏歌曲總數")
    print("=" * 50)
    status, data = spotify(token, "/me/tracks", {"limit": 1})
    print(f"總收藏數: {data.get('total')}")


if __name__ == "__main__":
    main()
