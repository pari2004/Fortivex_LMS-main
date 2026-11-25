"""Rate limiter for login.

Uses Redis if REDIS_URL is configured, falling back to a simple in-memory
implementation for local development without Redis.
"""

import time
from threading import Lock

from app.core.redis import redis_client

_WINDOW_SECONDS = 60
_MAX_FAILED_ATTEMPTS = 5

_failed_attempts: dict[str, list[float]] = {}
_lock = Lock()


def register_failed_attempt(key: str) -> None:
    now = time.time()
    if redis_client:
        try:
            redis_key = f"rate_limit:{key}"
            redis_client.zadd(redis_key, {str(now): now})
            redis_client.zremrangebyscore(redis_key, 0, now - _WINDOW_SECONDS)
            redis_client.expire(redis_key, _WINDOW_SECONDS)
            return
        except Exception:
            pass
    with _lock:
        window_start = now - _WINDOW_SECONDS
        attempts = [t for t in _failed_attempts.get(key, []) if t > window_start]
        attempts.append(now)
        _failed_attempts[key] = attempts


def register_success(key: str) -> None:
    """A successful login clears any prior failed attempts for this key."""
    if redis_client:
        try:
            redis_key = f"rate_limit:{key}"
            redis_client.delete(redis_key)
            return
        except Exception:
            pass
    with _lock:
        _failed_attempts.pop(key, None)


def seconds_until_retry(key: str) -> float | None:
    """None if the caller may attempt a login now, otherwise the number of
    seconds until the oldest attempt in the current window expires."""
    now = time.time()
    window_start = now - _WINDOW_SECONDS
    
    if redis_client:
        try:
            redis_key = f"rate_limit:{key}"
            redis_client.zremrangebyscore(redis_key, 0, window_start)
            count = redis_client.zcard(redis_key)
            if count < _MAX_FAILED_ATTEMPTS:
                return None
            
            oldest_records = redis_client.zrange(redis_key, 0, 0, withscores=True)
            if not oldest_records:
                return None
                
            oldest_time = oldest_records[0][1]
            return _WINDOW_SECONDS - (now - oldest_time)
        except Exception:
            pass
    with _lock:
        attempts = [t for t in _failed_attempts.get(key, []) if t > window_start]
        _failed_attempts[key] = attempts
        if len(attempts) < _MAX_FAILED_ATTEMPTS:
            return None
        return _WINDOW_SECONDS - (now - attempts[0])


def reset_all() -> None:
    """Test-only helper: clears all tracked state between test cases."""
    if redis_client:
        try:
            keys = redis_client.keys("rate_limit:*")
            if keys:
                redis_client.delete(*keys)
        except Exception:
            pass
    with _lock:
        _failed_attempts.clear()
