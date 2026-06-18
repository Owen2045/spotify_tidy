import os
from typing import Generator

from sqlmodel import Session, create_engine

engine = create_engine(os.getenv("DATABASE_URL"))


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
