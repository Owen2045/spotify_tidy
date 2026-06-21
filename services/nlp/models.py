from datetime import date, datetime
from typing import List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import ARRAY, Column, Text
from sqlmodel import Field, SQLModel


class Track(SQLModel, table=True):
    __tablename__ = "tracks"

    id: str = Field(primary_key=True)
    name: str = Field(max_length=500)
    artist_names: List[str] = Field(sa_column=Column(ARRAY(Text()), nullable=False))
    album_name: Optional[str] = Field(default=None, max_length=500)
    release_date: Optional[date] = None
    duration_ms: Optional[int] = None
    explicit: bool = Field(default=False)
    added_at: Optional[datetime] = None
    description: Optional[str] = None
    embedding: Optional[List[float]] = Field(
        default=None, sa_column=Column(Vector(1024), nullable=True)
    )


class TrackGenre(SQLModel, table=True):
    __tablename__ = "track_genres"

    track_id: str = Field(foreign_key="tracks.id", primary_key=True)
    genre: str = Field(max_length=100, primary_key=True)
    source: str = Field(max_length=50, primary_key=True)
