import os

# Test-only placeholder values, set before any app module is imported (Settings
# is read at import time). Not a real secret, not a reachable database — the
# DB-dependent tests intentionally exercise the "database unreachable" path
# since no local PostgreSQL is available in this environment.
os.environ.setdefault("DATABASE_URL", "postgresql://user:password@localhost:5432/fortivex_lms_test")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-not-used-in-any-real-environment")
os.environ["REDIS_URL"] = ""

import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import reset_all as reset_login_rate_limit
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def _reset_login_rate_limit():
    """Login rate-limit state is a process-global dict (app/core/rate_limit.py),
    so without this it would leak between test functions in the same pytest
    process and make unrelated tests flaky depending on run order."""
    reset_login_rate_limit()
    yield
    reset_login_rate_limit()
