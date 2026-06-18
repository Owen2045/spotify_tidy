import logging
import os
import sys

LOG_DIR = "/logs"
SERVICE = "spotify"


def get_logger(name: str = SERVICE) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] [" + SERVICE + "] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)
    logger.addHandler(stdout_handler)

    os.makedirs(LOG_DIR, exist_ok=True)
    file_handler = logging.FileHandler(f"{LOG_DIR}/{SERVICE}.log", encoding="utf-8")
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    return logger
