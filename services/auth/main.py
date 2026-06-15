import os
import psycopg2
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import bcrypt
from jose import jwt, JWTError
from spotipy.oauth2 import SpotifyOAuth
from spotipy.cache_handler import MemoryCacheHandler
from dotenv import load_dotenv

load_dotenv()

FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:3000")
DATABASE_URL  = os.getenv("DATABASE_URL")
JWT_SECRET    = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

SCOPES = " ".join([
    "playlist-read-private",
    "playlist-modify-private",
    "playlist-modify-public",
    "user-library-read",
    "user-library-modify",
])

sp_oauth = SpotifyOAuth(
    client_id=os.getenv("SPOTIPY_CLIENT_ID"),
    client_secret=os.getenv("SPOTIPY_CLIENT_SECRET"),
    redirect_uri=os.getenv("SPOTIPY_REDIRECT_URI"),
    scope=SCOPES,
    open_browser=False,
    cache_handler=MemoryCacheHandler(),
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


@contextmanager
def get_conn():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()


def make_jwt(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    return jwt.encode({"sub": user_id, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def require_auth(authorization: str = Header(...)) -> str:
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401)
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["sub"]
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token")


class AuthBody(BaseModel):
    email: str
    password: str


# ── 帳號系統 ──────────────────────────────────────────────

@app.post("/auth/register")
def register(body: AuthBody):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (body.email,))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="Email already registered")
            cur.execute(
                "INSERT INTO users (email, hashed_password) VALUES (%s, %s) RETURNING id",
                (body.email, hash_password(body.password)),
            )
            user_id = str(cur.fetchone()[0])
            conn.commit()
    return {"user_id": user_id, "token": make_jwt(user_id)}


@app.post("/auth/login")
def login(body: AuthBody):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, hashed_password FROM users WHERE email = %s", (body.email,))
            row = cur.fetchone()
    if not row or not verify_password(body.password, row[1]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"user_id": str(row[0]), "token": make_jwt(str(row[0]))}


# ── Spotify OAuth 綁定 ────────────────────────────────────

@app.get("/auth/spotify/connect")
def spotify_connect(user_id: str = Depends(require_auth)):
    # 把 user_id 塞進 state，callback 時用來識別要綁哪個帳號
    return JSONResponse({"auth_url": sp_oauth.get_authorize_url(state=user_id)})


@app.get("/auth/spotify/callback")
def spotify_callback(code: str = "", error: str = "", state: str = ""):
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/?spotify_error={error}")

    token_info = sp_oauth.get_access_token(code, as_dict=True, check_cache=False)
    expires_at = datetime.fromtimestamp(token_info["expires_at"], tz=timezone.utc)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at, scope)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    access_token = EXCLUDED.access_token,
                    refresh_token = EXCLUDED.refresh_token,
                    expires_at    = EXCLUDED.expires_at,
                    scope         = EXCLUDED.scope,
                    updated_at    = NOW()
            """, (state, token_info["access_token"], token_info["refresh_token"],
                  expires_at, token_info.get("scope", "")))
            conn.commit()

    return RedirectResponse(FRONTEND_URL)


@app.delete("/auth/spotify/disconnect")
def spotify_disconnect(user_id: str = Depends(require_auth)):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM spotify_tokens WHERE user_id = %s", (user_id,))
            conn.commit()
    return {"message": "Spotify disconnected"}


# ── 內部 API（給其他 service 用，不對外暴露）──────────────

@app.get("/auth/internal/token/{user_id}")
def internal_get_spotify_token(user_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT access_token, refresh_token, expires_at, scope FROM spotify_tokens WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Spotify not connected")

    access_token, refresh_token, expires_at, scope = row

    # Token 快過期則自動 refresh
    if expires_at - timedelta(seconds=60) <= datetime.now(timezone.utc):
        refreshed     = sp_oauth.refresh_access_token(refresh_token)
        access_token  = refreshed["access_token"]
        new_expires   = datetime.fromtimestamp(refreshed["expires_at"], tz=timezone.utc)
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE spotify_tokens SET access_token=%s, expires_at=%s, updated_at=NOW() WHERE user_id=%s",
                    (access_token, new_expires, user_id),
                )
                conn.commit()

    return {"access_token": access_token, "scope": scope}
