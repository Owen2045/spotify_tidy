import json
import os
from contextlib import asynccontextmanager

import requests
from arq import create_pool
from arq.connections import RedisSettings
from fastapi import Depends, FastAPI, HTTPException
from pgvector.sqlalchemy import Vector
from sqlalchemy import func, text
from sqlmodel import Session, col, select

from admin import create_admin
from database import engine, get_session
from logger import get_logger
from models import Track, TrackGenre

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")

logger = get_logger()

REDIS_SETTINGS = RedisSettings(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", "6379")),
)

arq_pool = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global arq_pool
    arq_pool = await create_pool(REDIS_SETTINGS)
    yield
    await arq_pool.aclose()


app = FastAPI(lifespan=lifespan)
create_admin(app)

AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth:8001")
SPOTIFY_API = "https://api.spotify.com/v1"


# ── Sync ────────────────────────────────────────────────────────────────────

@app.post("/sync/{user_id}")
async def sync_tracks(user_id: str):
    job = await arq_pool.enqueue_job("sync_task", user_id, _job_id=f"sync_{user_id}")
    if job is None:
        return {"status": "already_running"}
    return {"job_id": job.job_id, "status": "queued"}


@app.get("/sync/progress/{user_id}")
async def sync_progress(user_id: str):
    raw = await arq_pool.get(f"sync_progress:{user_id}")
    if not raw:
        return {"status": "idle"}
    return json.loads(raw)


# ── Enrich ──────────────────────────────────────────────────────────────────

@app.post("/enrich")
async def enrich(limit: int = 5100):
    job = await arq_pool.enqueue_job("enrich_task", limit, _job_id="enrich")
    if job is None:
        return {"status": "already_running"}
    return {"job_id": job.job_id, "status": "queued"}


@app.get("/enrich/progress")
async def enrich_progress():
    raw = await arq_pool.get("enrich_progress")
    if not raw:
        return {"status": "idle"}
    return json.loads(raw)


# ── Embed ────────────────────────────────────────────────────────────────────

@app.post("/embed")
async def embed(limit: int = 10000):
    job = await arq_pool.enqueue_job("embed_task", limit, _job_id="embed")
    if job is None:
        return {"status": "already_running"}
    return {"job_id": job.job_id, "status": "queued"}


@app.get("/embed/progress")
async def embed_progress():
    raw = await arq_pool.get("embed_progress")
    if not raw:
        return {"status": "idle"}
    return json.loads(raw)


# ── Search ───────────────────────────────────────────────────────────────────

@app.get("/search")
def search(q: str, limit: int = 20, session: Session = Depends(get_session)):
    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/embed",
            json={"model": "bge-m3", "input": [q]},
            timeout=30,
        )
        resp.raise_for_status()
        query_vec = resp.json()["embeddings"][0]
    except Exception as e:
        raise HTTPException(503, f"Ollama embed failed: {e}")

    rows = session.exec(
        select(Track)
        .where(Track.embedding != None)
        .order_by(Track.embedding.op("<=>")(query_vec))
        .limit(limit)
    ).all()

    return {"query": q, "items": [t.model_dump(exclude={"embedding"}) for t in rows]}


# ── Studio API ───────────────────────────────────────────────────────────────

@app.get("/tracks")
def list_tracks(session: Session = Depends(get_session)):
    total = session.exec(select(func.count()).select_from(Track)).one()
    tracks = session.exec(select(Track).order_by(col(Track.added_at).desc())).all()
    return {"total": total, "items": [t.model_dump(exclude={"embedding"}) for t in tracks]}
