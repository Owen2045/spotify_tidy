import os
import time
import spotipy
import time

from typing import List, Dict, Optional, Annotated
from pydantic import BaseModel, Field, StringConstraints


from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware


from pathlib import Path
from dotenv import load_dotenv
from spotipy.oauth2 import SpotifyOAuth

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI()

# 設定 CORS 允許 Vite 等前端框架跨域連線
FRONTEND_URL = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


TrackURI = Annotated[str, StringConstraints(pattern=r"^spotify:track:[A-Za-z0-9]{22}$")]
TrackID  = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9]{22}$")]

class UrisPayload(BaseModel):
    uris: List[TrackURI] = Field(min_length=1)

class IdsPayload(BaseModel):
    ids: List[TrackID] = Field(min_length=1)
        

# 基本設定：集中向 deploy 目錄讀取本機機密變數 (Docker 模式下此步為備援，不影響 compose 外部變數注入)
dotenv_path = BASE_DIR.parent / "deploy" / ".env.dev"
if dotenv_path.exists():
    load_dotenv(dotenv_path=dotenv_path)
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
    raise RuntimeError("請在 deploy/.env.dev 確實設定 SPOTIPY_CLIENT_ID 與 SPOTIPY_CLIENT_SECRET")

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


# FastAPI 原首頁與靜態檔已拔除，相關畫面展示皆交由 React Frontend 管理。


# OAuth
@app.get("/login")
def login():
    url = sp_oauth.get_authorize_url()
    return JSONResponse({"auth_url": url})


@app.get("/callback")
def callback(code: str = "", error: str = ""):
    global _sp
    if error:
        return JSONResponse({"error": f"授權失敗: {error}"}, status_code=400)
    token_info = sp_oauth.get_access_token(code, as_dict=True)
    _sp = spotipy.Spotify(auth=token_info["access_token"])
    
    # 登入成功後，將畫面導向回 React 前端
    return RedirectResponse(FRONTEND_URL)


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


# API 指定播放清單拿歌曲
@app.get("/api/playlist/{pid}/tracks")
def playlist_tracks(pid: str):
    sp = ensure_spotify()
    out: List[Dict] = []
    fields = "items(track(uri,id,name,artists(name),album(name))),next"
    page = sp.playlist_items(pid, fields=fields, additional_types=("track",), limit=100)
    while True:
        for it in page["items"]:
            t = it.get("track")
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


# API 播放清單新增
@app.post("/api/playlist/{pid}/add")
def playlist_add(pid: str, payload: UrisPayload):
    # sp = ensure_spotify()
    # sp.playlist_add_items(pid, payload.uris)
    print(f"MOCK API: [POST] /api/playlist/{pid}/add")
    print(f"Payload URIs: {payload.uris}")
    return {"added": len(payload.uris), "status": "mocked"}


# API 播放清單移除
@app.post("/api/playlist/{pid}/remove")
def playlist_remove(pid: str, payload: UrisPayload):
    # sp = ensure_spotify()
    # sp.playlist_remove_all_occurrences_of_items(pid, payload.uris)
    print(f"MOCK API: [POST] /api/playlist/{pid}/remove")
    print(f"Payload URIs: {payload.uris}")
    return {"removed": len(payload.uris), "status": "mocked"}



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
                    "is_playable": t["is_playable"],
                    "release_date": t["album"]["release_date"],
                    
                }
            )
        # if len(items) < limit:
        #     break
        # offset += 50
        # TODO UI 測試先拿50筆
        break
    return out



# 已按讚新增
@app.post("/api/liked/add")
async def liked_add(body: Dict):
    # sp = ensure_spotify()
    ids: List[str] = body.get("ids", [])
    print("MOCK API: [POST] /api/liked/add")
    print(f"Payload IDs: {ids}")
    return {"ok": True, "added": len(ids), "status": "mocked"}


# 已按讚移除
@app.post("/api/liked/remove")
def liked_remove(payload: IdsPayload):
    # sp = ensure_spotify()
    # sp.current_user_saved_tracks_delete(tracks=payload.ids)
    print("MOCK API: [POST] /api/liked/remove")
    print(f"Payload IDs: {payload.ids}")
    return {"removed": len(payload.ids), "status": "mocked"}