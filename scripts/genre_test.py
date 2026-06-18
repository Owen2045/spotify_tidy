"""
測試腳本：用 Last.fm API 抓取 track.getTopTags，驗證曲風標籤的真實資料品質。

使用前：
1. 去 https://www.last.fm/api/account/create 申請免費 API key
2. 設定環境變數：export LASTFM_API_KEY=你的key
3. 執行：python test_lastfm_tags.py


Application name	sideproject
API key	937c7095ea5822153bfdccef6a3c6a13
Shared secret	79b898f709e818f80ccd2902cad20774
Registered to	sam24654113
"""

import os
import sys
import time

import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)  # ponytail: corp proxy workaround

API_KEY = "937c7095ea5822153bfdccef6a3c6a13"
API_URL = "https://ws.audioscrobbler.com/2.0/"

# 跨曲風測試集：抒情 / EMO / 搖滾 / 快節奏舞曲 / 中文歌（測冷門覆蓋率）
TEST_TRACKS = [
    ("Adele", "Someone Like You", "抒情"),
    ("My Chemical Romance", "Welcome to the Black Parade", "EMO"),
    ("Nirvana", "Smells Like Teen Spirit", "搖滾"),
    ("The Weeknd", "Blinding Lights", "快節奏/舞曲"),
    ("周杰倫", "晴天", "中文歌-測試覆蓋率"),
]


def get_top_tags(artist: str, track: str) -> list[dict]:
    params = {
        "method": "track.gettoptags",
        "artist": artist,
        "track": track,
        "api_key": API_KEY,
        "format": "json",
    }
    resp = requests.get(API_URL, params=params, timeout=10, verify=False)
    data = resp.json()

    if "error" in data:
        print(f"  [錯誤] {data.get('message', '未知錯誤')}")
        return []

    tags = data.get("toptags", {}).get("tag", [])
    return [{"name": t["name"], "count": t["count"]} for t in tags]


def main():
    if not API_KEY:
        print("錯誤：請先設定環境變數 LASTFM_API_KEY")
        print("申請網址：https://www.last.fm/api/account/create")
        sys.exit(1)

    for artist, track, label in TEST_TRACKS:
        print(f"\n=== {artist} - {track} ({label}) ===")
        tags = get_top_tags(artist, track)

        if not tags:
            print("  沒有任何標籤")
        else:
            for t in tags[:15]:  # 只看前15個，足夠判斷雜訊比例
                print(f"  {t['name']:<25} count={t['count']}")

        time.sleep(0.3)  # 簡單放慢速度，避免打太快


if __name__ == "__main__":
    main()