import logging
import redis
from app.core.config import get_settings

logger = logging.getLogger("fortivex_lms")
settings = get_settings()

redis_client = None

if settings.REDIS_URL:
    try:
        r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1, socket_timeout=1)
        r.ping()
        redis_client = r
    except Exception:
        logger.info("Redis is unreachable at %s; operating in in-memory fallback mode.", settings.REDIS_URL)
        redis_client = None
