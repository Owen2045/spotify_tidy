import os

from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from database import engine
from models import Track, TrackGenre

STUDIO_USER = os.getenv("STUDIO_USER", "admin")
STUDIO_PASS = os.getenv("STUDIO_PASS", "admin")


class BasicAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        if form.get("username") == STUDIO_USER and form.get("password") == STUDIO_PASS:
            request.session.update({"studio": "ok"})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return request.session.get("studio") == "ok"


class TrackAdmin(ModelView, model=Track):
    name = "Track"
    name_plural = "Tracks"
    icon = "fa-solid fa-music"
    column_list = [Track.name, Track.artist_names, Track.album_name, Track.release_date, Track.explicit, Track.added_at]
    column_searchable_list = [Track.name]
    column_sortable_list = [Track.name, Track.release_date, Track.added_at]
    column_details_list = [Track.id, Track.name, Track.artist_names, Track.album_name,
                           Track.release_date, Track.duration_ms, Track.explicit,
                           Track.added_at, Track.description]
    form_excluded_columns = [Track.added_at]
    page_size = 50


class TrackGenreAdmin(ModelView, model=TrackGenre):
    name = "Track Genre"
    name_plural = "Track Genres"
    icon = "fa-solid fa-tag"
    column_list = [TrackGenre.track_id, TrackGenre.genre, TrackGenre.source]
    column_searchable_list = [TrackGenre.genre, TrackGenre.track_id]
    column_sortable_list = [TrackGenre.genre, TrackGenre.source]
    page_size = 100


def create_admin(app) -> Admin:
    admin = Admin(
        app,
        engine,
        authentication_backend=BasicAuth(secret_key=os.getenv("JWT_SECRET", "dev-secret")),
        base_url="/studio",
        title="Studio",
    )
    admin.add_view(TrackAdmin)
    admin.add_view(TrackGenreAdmin)
    return admin
