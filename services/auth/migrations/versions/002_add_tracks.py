"""add tracks and track_genres

Revision ID: 002
Revises: 001
Create Date: 2026-06-18
"""
import sqlalchemy as sa
from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "tracks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("artist_names", sa.ARRAY(sa.Text()), nullable=False),
        sa.Column("album_name", sa.String(500)),
        sa.Column("release_date", sa.Date()),
        sa.Column("duration_ms", sa.Integer()),
        sa.Column("explicit", sa.Boolean(), server_default="false"),
        sa.Column("added_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("description", sa.Text()),
    )
    op.execute("ALTER TABLE tracks ADD COLUMN embedding vector(1024)")

    op.create_table(
        "track_genres",
        sa.Column("track_id", sa.String(), nullable=False),
        sa.Column("genre", sa.String(100), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.ForeignKeyConstraint(["track_id"], ["tracks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("track_id", "genre", "source"),
    )


def downgrade() -> None:
    op.drop_table("track_genres")
    op.drop_table("tracks")
