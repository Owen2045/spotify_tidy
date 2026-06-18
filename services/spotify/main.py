import os
import requests
import spotipy
from typing import List, Dict, Annotated

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, StringConstraints
from jose import jwt, JWTError
from dotenv import load_dotenv

from logger import get_logger

logger = get_logger()

load_dotenv()

FRONTEND_URL      = os.getenv("FRONTEND_URL", "http://localhost:3000")
JWT_SECRET        = os.getenv("JWT_SECRET")
JWT_ALGORITHM     = "HS256"
AUTH_SERVICE_URL  = os.getenv("AUTH_SERVICE_URL", "http://auth:8001")

app = FastAPI()
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


def require_auth(authorization: str = Header(...)) -> str:
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401)
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["sub"]
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token")


def get_spotify(user_id: str) -> spotipy.Spotify:
    resp = requests.get(f"{AUTH_SERVICE_URL}/auth/internal/token/{user_id}", timeout=5)
    if resp.status_code == 404:
        raise HTTPException(status_code=403, detail="Spotify not connected")
    if not resp.ok:
        raise HTTPException(status_code=502, detail="Auth service error")
    return spotipy.Spotify(auth=resp.json()["access_token"])


# ── 使用者 ────────────────────────────────────────────────

@app.get("/spotify/me")
def me(user_id: str = Depends(require_auth)):
    return get_spotify(user_id).current_user()


# ── 歌單 ──────────────────────────────────────────────────

@app.get("/spotify/playlists")
def playlists(user_id: str = Depends(require_auth)):
    sp = get_spotify(user_id)
    items, offset = [], 0
    while True:
        page = sp.current_user_playlists(limit=50, offset=offset)
        items += page["items"]
        if not page["next"]:
            break
        offset += 50
    return [{"name": p["name"], "id": p["id"]} for p in items]


@app.get("/spotify/playlist/{pid}/tracks")
def playlist_tracks(pid: str, user_id: str = Depends(require_auth)):
    sp = get_spotify(user_id)
    out: List[Dict] = []
    fields = "items(track(uri,id,name,artists(name),album(name))),next"
    page = sp.playlist_items(pid, fields=fields, additional_types=("track",), limit=100)
    while True:
        for it in page["items"]:
            t = it.get("track")
            if not t:
                continue
            out.append({
                "id": t["id"],
                "uri": t["uri"],
                "name": t["name"],
                "artists": ", ".join(a["name"] for a in t["artists"]),
                "album": t["album"]["name"],
            })
        if not page.get("next"):
            break
        page = sp.next(page)
    return out


@app.post("/spotify/playlist/{pid}/add")
def playlist_add(pid: str, payload: UrisPayload, user_id: str = Depends(require_auth)):
    get_spotify(user_id).playlist_add_items(pid, payload.uris)
    return {"added": len(payload.uris)}


@app.post("/spotify/playlist/{pid}/remove")
def playlist_remove(pid: str, payload: UrisPayload, user_id: str = Depends(require_auth)):
    get_spotify(user_id).playlist_remove_all_occurrences_of_items(pid, payload.uris)
    return {"removed": len(payload.uris)}


# ── 已按讚 ────────────────────────────────────────────────

@app.get("/spotify/liked")
def liked(user_id: str = Depends(require_auth)):
    sp = get_spotify(user_id)
    out: List[Dict] = []
    limit, offset = 50, 0
    while True:
        page = sp.current_user_saved_tracks(limit=limit, offset=offset)
        items = page.get("items", [])
        for it in items:
            t = it["track"]
            out.append({
                "id": t["id"],
                "uri": t["uri"],
                "name": t["name"],
                "artists": ", ".join(a["name"] for a in t["artists"]),
                "album": t["album"]["name"],
                "release_date": t["album"].get("release_date"),
            })
        if len(items) < limit:
            break
        offset += limit
    return out


@app.post("/spotify/liked/add")
def liked_add(payload: IdsPayload, user_id: str = Depends(require_auth)):
    get_spotify(user_id).current_user_saved_tracks_add(tracks=payload.ids)
    return {"added": len(payload.ids)}


@app.post("/spotify/liked/remove")
def liked_remove(payload: IdsPayload, user_id: str = Depends(require_auth)):
    get_spotify(user_id).current_user_saved_tracks_delete(tracks=payload.ids)
    return {"removed": len(payload.ids)}
