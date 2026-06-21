import json
import os
from datetime import datetime

import requests
from arq.connections import RedisSettings
from openai import OpenAI
from sqlmodel import Session, col, select

from database import engine
from logger import get_logger
from models import Track, TrackGenre

logger = get_logger()

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


def _parse_release_date(raw: str):
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


async def sync_task(ctx, user_id: str):
    redis = ctx["redis"]
    key = f"sync_progress:{user_id}"

    async def push(done: int, status: str):
        await redis.set(key, json.dumps({"done": done, "status": status}), ex=300)

    await push(0, "starting")
    try:
        token = _spotify_token(user_id)
        total_synced = 0
        offset = 0

        with Session(engine) as session:
            latest_added_at = session.exec(
                select(Track.added_at).order_by(col(Track.added_at).desc())
            ).first()

            while True:
                data = _spotify_get(token, "/me/tracks", {"limit": 50, "offset": offset})
                items = data.get("items", [])
                if not items:
                    break

                page_items = []
                done_flag = False

                for item in items:
                    added_at = datetime.fromisoformat(item["added_at"].replace("Z", "+00:00"))
                    if latest_added_at and added_at <= latest_added_at:
                        done_flag = True
                        break
                    page_items.append((item, item["track"]))

                if page_items:
                    artist_ids = list({a["id"] for _, t in page_items for a in t["artists"]})
                    artist_genres: dict[str, list[str]] = {}
                    for i in range(0, len(artist_ids), 50):
                        batch = artist_ids[i : i + 50]
                        resp = _spotify_get(token, "/artists", {"ids": ",".join(batch)})
                        for artist in resp.get("artists") or []:
                            if artist:
                                artist_genres[artist["id"]] = artist.get("genres", [])

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
                    await push(total_synced, "running")
                    logger.info(f"[sync] progress: {total_synced} tracks")

                if done_flag or len(items) < 50:
                    break
                offset += 50

        await redis.set(key, json.dumps({"done": total_synced, "status": "done"}), ex=60)
        logger.info(f"[sync] done: {total_synced}")
        return {"synced": total_synced}

    except Exception as e:
        await redis.set(key, json.dumps({"done": 0, "status": "error", "error": str(e)}), ex=60)
        logger.error(f"[sync] error: {e}")
        raise


async def enrich_task(ctx, limit: int = 5100):
    redis = ctx["redis"]
    key = "enrich_progress"

    async def push(done: int, total: int, status: str):
        await redis.set(key, json.dumps({"done": done, "total": total, "status": status}), ex=600)

    await push(0, 0, "starting")
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        with Session(engine) as session:
            tracks = session.exec(
                select(Track).where(Track.description == None).limit(limit)
            ).all()
            total = len(tracks)
            await push(0, total, "running")

            done = 0
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
                done += 1
                if done % 50 == 0:
                    session.commit()
                    await push(done, total, "running")
                    logger.info(f"[enrich] progress: {done}/{total}")

            session.commit()

        await redis.set(key, json.dumps({"done": done, "total": total, "status": "done"}), ex=60)
        logger.info(f"[enrich] done: {done}")
        return {"enriched": done}

    except Exception as e:
        await redis.set(key, json.dumps({"done": 0, "total": 0, "status": "error", "error": str(e)}), ex=60)
        logger.error(f"[enrich] error: {e}")
        raise


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
EMBED_BATCH = 32


async def embed_task(ctx, limit: int = 10000):
    redis = ctx["redis"]
    key = "embed_progress"

    async def push(done: int, total: int, status: str):
        await redis.set(key, json.dumps({"done": done, "total": total, "status": status}), ex=600)

    await push(0, 0, "starting")
    try:
        with Session(engine) as session:
            tracks = session.exec(
                select(Track)
                .where(Track.description != None)
                .where(Track.embedding == None)
                .limit(limit)
            ).all()
            total = len(tracks)
            await push(0, total, "running")
            logger.info(f"[embed] {total} tracks to embed")

            done = 0
            for i in range(0, total, EMBED_BATCH):
                batch = tracks[i : i + EMBED_BATCH]
                texts = [t.description for t in batch]

                resp = requests.post(
                    f"{OLLAMA_BASE_URL}/api/embed",
                    json={"model": "bge-m3", "input": texts},
                    timeout=120,
                )
                resp.raise_for_status()
                embeddings = resp.json()["embeddings"]

                for track, vec in zip(batch, embeddings):
                    track.embedding = vec

                session.commit()
                done += len(batch)
                await push(done, total, "running")
                logger.info(f"[embed] progress: {done}/{total}")

        await redis.set(key, json.dumps({"done": done, "total": total, "status": "done"}), ex=60)
        logger.info(f"[embed] done: {done}")
        return {"embedded": done}

    except Exception as e:
        await redis.set(key, json.dumps({"done": 0, "total": 0, "status": "error", "error": str(e)}), ex=60)
        logger.error(f"[embed] error: {e}")
        raise


class WorkerSettings:
    functions = [sync_task, enrich_task, embed_task]
    job_timeout = 7200  # 2 hours — enrich/embed tasks can run long
    redis_settings = RedisSettings(
        host=os.getenv("REDIS_HOST", "redis"),
        port=int(os.getenv("REDIS_PORT", "6379")),
    )
