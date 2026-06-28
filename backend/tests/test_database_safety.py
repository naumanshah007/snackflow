import pytest

import app.database as database_module


def test_development_allows_sqlite_startup(monkeypatch):
    monkeypatch.setattr(database_module, "database_url", "sqlite:///./snackflow.db")
    monkeypatch.setattr(database_module.settings, "environment", "development")

    database_module.assert_persistent_database_for_non_development()


def test_production_blocks_sqlite_startup(monkeypatch):
    monkeypatch.setattr(database_module, "database_url", "sqlite:///./snackflow.db")
    monkeypatch.setattr(database_module.settings, "environment", "production")

    with pytest.raises(RuntimeError, match="resolved to SQLite"):
        database_module.assert_persistent_database_for_non_development()


def test_production_allows_postgres_startup(monkeypatch):
    monkeypatch.setattr(database_module, "database_url", "postgresql://user:pass@example.com/snackflow")
    monkeypatch.setattr(database_module.settings, "environment", "production")

    database_module.assert_persistent_database_for_non_development()
