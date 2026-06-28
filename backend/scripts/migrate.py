"""Run Alembic migrations against the configured SnackFlow database."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

from app.database import assert_persistent_database_for_non_development  # noqa: E402


def main() -> None:
    assert_persistent_database_for_non_development()
    alembic_cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    command.upgrade(alembic_cfg, "head")


if __name__ == "__main__":
    main()
