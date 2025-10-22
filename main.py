import os
import time
from typing import List, Dict, Optional

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from dotenv import load_dotenv
import spotipy
from spotipy.oauth2 import SpotifyOAuth

# 基本設定
load_dotenv()
SCOPES = " ".join(
    [
        "playlist-read-private",
        "playlist-modify-private",
        "playlist-modify-public",
        "user-library-read",
        "user-library-modify",
    ]
)

CLIENT_ID = os.getenv("SPOTIPY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIPY_CLIENT_SECRET")
REDIRECT_URI = os.getenv("SPOTIPY_REDIRECT_URI") or "http://localhost:8765/callback"
CACHE_PATH = ".cache-web"

if not CLIENT_ID or not CLIENT_SECRET:
    raise RuntimeError("請在 .env 設定 SPOTIPY_CLIENT_ID 與 SPOTIPY_CLIENT_SECRET")

sp_oauth = SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=SCOPES,
    cache_path=CACHE_PATH,
    open_browser=True,
    show_dialog=False,
)

_sp: Optional[spotipy.Spotify] = None


def ensure_spotify() -> spotipy.Spotify:
    """
    確保有可用的 spotipy client
    會從 cache 取 token，若過期自動 refresh
    若 refresh token 失效則刪除 cache 並要求重新登入
    """
    global _sp
    if _sp is not None:
        return _sp

    token_info = sp_oauth.get_cached_token()

    # 若 cache 不存在，表示使用者尚未登入
    if not token_info:
        raise RuntimeError("NOT_AUTH")

    # 若 access token 過期
    if sp_oauth.is_token_expired(token_info):
        try:
            print("access token expired, trying to refresh...")
            token_info = sp_oauth.refresh_access_token(token_info["refresh_token"])
        except Exception as e:
            print(f"refresh token failed: {e}")
            # refresh token 無效，刪除 cache 並要求重新登入
            if os.path.exists(CACHE_PATH):
                os.remove(CACHE_PATH)
            _sp = None
            raise RuntimeError("NOT_AUTH")

    # 建立新的 Spotify client 並回傳
    _sp = spotipy.Spotify(auth=token_info["access_token"])
    return _sp


# FastAPI 設定
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# 頁面
@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# OAuth
@app.get("/login")
def login():
    url = sp_oauth.get_authorize_url()
    return JSONResponse({"auth_url": url})


@app.get("/callback")
def callback(code: str = "", error: str = ""):
    global _sp
    if error:
        return HTMLResponse(f"授權失敗: {error}", status_code=400)
    token_info = sp_oauth.get_access_token(code, as_dict=True)
    _sp = spotipy.Spotify(auth=token_info["access_token"])
    return RedirectResponse("/")


# API 基本資訊
@app.get("/api/me")
def me():
    try:
        sp = ensure_spotify()
        return sp.current_user()
    except RuntimeError as e:
        if str(e) == "NOT_AUTH":
            return JSONResponse({"authorized": False}, status_code=401)
        raise


# API 播放清單
@app.get("/api/playlists")
def playlists():
    sp = ensure_spotify()
    items, offset = [], 0
    while True:
        page = sp.current_user_playlists(limit=50, offset=offset)
        items += page["items"]
        if page["next"]:
            offset += 50
        else:
            break
    return [{"name": p["name"], "id": p["id"]} for p in items]


@app.get("/api/playlist/{pid}/tracks")
def playlist_tracks(pid: str):
    sp = ensure_spotify()
    out: List[Dict] = []
    fields = "items(track(uri,id,name,artists(name),album(name))),next"
    page = sp.playlist_items(pid, fields=fields, additional_types=("track",), limit=100)
    while True:
        for it in page["items"]:
            t = it.get("track")
            if t:
                out.append(
                    {
                        "id": t["id"],
                        "uri": t["uri"],
                        "name": t["name"],
                        "artists": ", ".join(a["name"] for a in t["artists"]),
                        "album": t["album"]["name"],
                    }
                )
        if page.get("next"):
            page = sp.next(page)
        else:
            break
    return out


@app.post("/api/playlist/{pid}/add")
async def playlist_add(pid: str, body: Dict):
    sp = ensure_spotify()
    uris: List[str] = body.get("uris", [])
    for i in range(0, len(uris), 100):
        sp.playlist_add_items(pid, uris[i : i + 100])
        time.sleep(0.2)
    return {"ok": True}


@app.post("/api/playlist/{pid}/remove")
async def playlist_remove(pid: str, body: Dict):
    sp = ensure_spotify()
    uris: List[str] = body.get("uris", [])
    for i in range(0, len(uris), 100):
        sp.playlist_remove_all_occurrences_of_items(pid, uris[i : i + 100])
        time.sleep(0.2)
    return {"ok": True}


# API 已按讚
@app.get("/api/liked")
def liked():
    sp = ensure_spotify()
    out: List[Dict] = []
    limit, offset = 50, 0
    while True:
        page = sp.current_user_saved_tracks(limit=limit, offset=offset)
        items = page.get("items", [])
        for it in items:
            t = it["track"]
            out.append(
                {
                    "id": t["id"],
                    "uri": t["uri"],
                    "name": t["name"],
                    "artists": ", ".join(a["name"] for a in t["artists"]),
                    "album": t["album"]["name"],
                }
            )
        if len(items) < limit:
            break
        offset += 50
    return out


@app.post("/api/liked/add")
async def liked_add(body: Dict):
    sp = ensure_spotify()
    ids: List[str] = body.get("ids", [])
    for i in range(0, len(ids), 50):
        sp.current_user_saved_tracks_add(tracks=ids[i : i + 50])
        time.sleep(0.2)
    return {"ok": True}


@app.post("/api/liked/remove")
async def liked_remove(body: Dict):
    sp = ensure_spotify()
    ids: List[str] = body.get("ids", [])
    for i in range(0, len(ids), 50):
        sp.current_user_saved_tracks_delete(tracks=ids[i : i + 50])
        time.sleep(0.2)
    return {"ok": True}
