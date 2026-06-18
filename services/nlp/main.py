import os
from datetime import date, datetime, timezone

import requests
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from openai import OpenAI
from sqlalchemy import func
from sqlmodel import Session, col, select

from admin import create_admin
from database import engine, get_session
from logger import get_logger
from models import Track, TrackGenre

logger = get_logger()

app = FastAPI()
create_admin(app)

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth:8001")
SPOTIFY_API = "https://api.spotify.com/v1"


def _spotify_token(user_id: str) -> str:
    resp = requests.get(f"{AUTH_SERVICE_URL}/auth/internal/token/{user_id}", timeout=5)
    resp.raise_for_status()
    return resp.json()["access_token"]


def _spotify_get(token: str, path: str, params: dict | None = None) -> dict:
    resp = requests.get(
        f"{SPOTIFY_API}{path}",
        headers={"Authorization": f"Bearer {token}"},
        params=params,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def _parse_release_date(raw: str) -> date | None:
    if not raw:
        return None
    try:
        if len(raw) == 10:
            return datetime.strptime(raw, "%Y-%m-%d").date()
        if len(raw) == 7:
            return datetime.strptime(raw, "%Y-%m").date()
        return datetime.strptime(raw[:4], "%Y").date()
    except ValueError:
        return None


# ── Sync ────────────────────────────────────────────────────────────────────

@app.post("/sync/{user_id}")
def sync_tracks(user_id: str, session: Session = Depends(get_session)):
    token = _spotify_token(user_id)

    latest_added_at = session.exec(
        select(Track.added_at).order_by(col(Track.added_at).desc())
    ).first()

    total_synced = 0
    offset = 0

    while True:
        data = _spotify_get(token, "/me/tracks", {"limit": 50, "offset": offset})
        items = data.get("items", [])
        if not items:
            break

        page_items: list[tuple[dict, dict]] = []
        done = False

        for item in items:
            track = item["track"]
            added_at = datetime.fromisoformat(item["added_at"].replace("Z", "+00:00"))
            if latest_added_at and added_at <= latest_added_at:
                done = True
                break
            page_items.append((item, track))

        if page_items:
            # 這一頁的 artist genres
            artist_ids = list({a["id"] for _, t in page_items for a in t["artists"]})
            artist_genres: dict[str, list[str]] = {}
            for i in range(0, len(artist_ids), 50):
                batch = artist_ids[i : i + 50]
                resp = _spotify_get(token, "/artists", {"ids": ",".join(batch)})
                for artist in resp.get("artists") or []:
                    if artist:
                        artist_genres[artist["id"]] = artist.get("genres", [])

            # Upsert + commit（每頁一次，斷點安全）
            for item, track in page_items:
                added_at = datetime.fromisoformat(item["added_at"].replace("Z", "+00:00"))
                session.merge(Track(
                    id=track["id"],
                    name=track["name"],
                    artist_names=[a["name"] for a in track["artists"]],
                    album_name=track["album"]["name"],
                    release_date=_parse_release_date(track["album"].get("release_date", "")),
                    duration_ms=track["duration_ms"],
                    explicit=track["explicit"],
                    added_at=added_at,
                ))
                for artist in track["artists"]:
                    for genre in artist_genres.get(artist["id"], []):
                        session.merge(TrackGenre(track_id=track["id"], genre=genre, source="spotify"))

            session.commit()
            total_synced += len(page_items)
            logger.info(f"[sync] progress: {total_synced} tracks saved")

        if done or len(items) < 50:
            break

        offset += 50

    logger.info(f"[sync] done: {total_synced} tracks")
    return {"synced": total_synced}


# ── Enrich ──────────────────────────────────────────────────────────────────

def _enrich_worker(limit: int) -> None:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    with Session(engine) as session:
        tracks = session.exec(
            select(Track).where(Track.description == None).limit(limit)
        ).all()

        total = 0
        for track in tracks:
            genres = session.exec(
                select(TrackGenre.genre).where(TrackGenre.track_id == track.id)
            ).all()
            year = track.release_date.year if track.release_date else "未知"
            prompt = (
                "你是音樂描述專家。根據以下歌曲資訊，用繁體中文寫一段 50-100 字的描述，"
                "涵蓋曲風氛圍、適合場景、情緒特色。\n\n"
                f"歌名：{track.name}\n"
                f"歌手：{', '.join(track.artist_names)}\n"
                f"專輯：{track.album_name or '未知'}\n"
                f"發行年份：{year}\n"
                f"曲風標籤：{', '.join(genres) if genres else '無'}\n\n"
                "只輸出描述，不要其他文字。"
            )
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.7,
            )
            track.description = resp.choices[0].message.content.strip()
            total += 1
            if total % 50 == 0:
                session.commit()
                logger.info(f"[enrich] progress: {total}/{len(tracks)}")

        session.commit()
        logger.info(f"[enrich] done: {total}")


@app.post("/enrich")
def enrich(background_tasks: BackgroundTasks, limit: int = 5100):
    background_tasks.add_task(_enrich_worker, limit)
    return {"status": "started", "limit": limit}


# ── Stubs（等部署完成後實作）────────────────────────────────────────────────

@app.get("/search")
def search(q: str, limit: int = 20):
    # ponytail: 等 Ollama bge-m3 部署後實作
    raise HTTPException(503, "Ollama not yet deployed")


@app.post("/embed")
def embed():
    # ponytail: 等 Ollama bge-m3 部署後實作
    raise HTTPException(503, "Ollama not yet deployed")


# ── Studio API ───────────────────────────────────────────────────────────────

@app.get("/tracks")
def list_tracks(session: Session = Depends(get_session)):
    total = session.exec(select(func.count()).select_from(Track)).one()
    tracks = session.exec(select(Track).order_by(col(Track.added_at).desc())).all()
    return {"total": total, "items": [t.model_dump() for t in tracks]}
