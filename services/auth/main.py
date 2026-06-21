import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel

from logger import get_logger

logger = get_logger()
from spotipy.oauth2 import SpotifyOAuth
from spotipy.cache_handler import MemoryCacheHandler
from sqlmodel import Session, select
from dotenv import load_dotenv

from database import get_session
from models import SpotifyToken, User

load_dotenv()

FRONTEND_URL  = os.getenv("FRONTEND_URL", "http://localhost:3000")
JWT_SECRET    = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

SCOPES = " ".join([
    "playlist-read-private",
    "playlist-modify-private",
    "playlist-modify-public",
    "user-library-read",
    "user-library-modify",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
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
def register(body: AuthBody, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=body.email, hashed_password=hash_password(body.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"user_id": str(user.id), "token": make_jwt(str(user.id))}


@app.post("/auth/login")
def login(body: AuthBody, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"user_id": str(user.id), "token": make_jwt(str(user.id))}


# ── Spotify OAuth 綁定 ────────────────────────────────────

@app.get("/auth/spotify/connect")
def spotify_connect(user_id: str = Depends(require_auth)):
    return JSONResponse({"auth_url": sp_oauth.get_authorize_url(state=user_id)})


@app.get("/auth/spotify/callback")
def spotify_callback(
    code: str = "",
    error: str = "",
    state: str = "",
    session: Session = Depends(get_session),
):
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/services/spotify?spotify_error={error}")

    token_info = sp_oauth.get_access_token(code, as_dict=True, check_cache=False)
    expires_at = datetime.fromtimestamp(token_info["expires_at"], tz=timezone.utc)
    user_uuid  = UUID(state)

    existing = session.exec(
        select(SpotifyToken).where(SpotifyToken.user_id == user_uuid)
    ).first()

    if existing:
        existing.access_token  = token_info["access_token"]
        existing.refresh_token = token_info["refresh_token"]
        existing.expires_at    = expires_at
        existing.scope         = token_info.get("scope", "")
        existing.updated_at    = datetime.now(timezone.utc)
        session.add(existing)
    else:
        session.add(SpotifyToken(
            user_id=user_uuid,
            access_token=token_info["access_token"],
            refresh_token=token_info["refresh_token"],
            expires_at=expires_at,
            scope=token_info.get("scope", ""),
        ))

    session.commit()
    return RedirectResponse(f"{FRONTEND_URL}/services/spotify")


@app.delete("/auth/spotify/disconnect")
def spotify_disconnect(user_id: str = Depends(require_auth), session: Session = Depends(get_session)):
    token = session.exec(
        select(SpotifyToken).where(SpotifyToken.user_id == UUID(user_id))
    ).first()
    if token:
        session.delete(token)
        session.commit()
    return {"message": "Spotify disconnected"}


@app.get("/auth/me")
def me(user_id: str = Depends(require_auth), session: Session = Depends(get_session)):
    user = session.get(User, UUID(user_id))
    if not user:
        raise HTTPException(status_code=404)
    return {"email": user.email}


# ── 內部 API（給其他 service 用，不對外暴露）──────────────

@app.get("/auth/internal/token/{user_id}")
def internal_get_spotify_token(user_id: str, session: Session = Depends(get_session)):
    token = session.exec(
        select(SpotifyToken).where(SpotifyToken.user_id == UUID(user_id))
    ).first()

    if not token:
        raise HTTPException(status_code=404, detail="Spotify not connected")

    if token.expires_at - timedelta(seconds=60) <= datetime.now(timezone.utc):
        refreshed            = sp_oauth.refresh_access_token(token.refresh_token)
        token.access_token   = refreshed["access_token"]
        token.expires_at     = datetime.fromtimestamp(refreshed["expires_at"], tz=timezone.utc)
        token.updated_at     = datetime.now(timezone.utc)
        session.add(token)
        session.commit()

    return {"access_token": token.access_token, "scope": token.scope}
