# AgriWatch KE — Supabase Cache & Alert Log Service
# © 2026 Cynthia Anguza. All Rights Reserved.
# IGAD Hackathon 2026 Submission.
#
# Drop-in replacement for the original SQLite cache_service.py.
# Uses supabase-py (REST API) — no PostgreSQL password required.
# Same public interface: get_cached(), set_cached()
# Also adds:  log_alert(), init_db()
#
# Falls back to in-memory dict if SUPABASE_URL / SUPABASE_SECRET_KEY not set.

import json
import time
import hashlib
import os
import logging
from datetime import datetime, timezone
from typing import Optional, Any

logger = logging.getLogger(__name__)

SUPABASE_URL        = os.environ.get("SUPABASE_URL", "")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")

# In-memory fallback when Supabase is not configured
_memory_cache: dict = {}

_supabase_client = None


def _get_client():
    """Return a cached Supabase client, or None if credentials are missing."""
    global _supabase_client
    if _supabase_client:
        return _supabase_client
    if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
        return None
    try:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
        return _supabase_client
    except Exception as e:
        logger.warning(f"Supabase client init failed — using in-memory cache. ({e})")
        return None


def init_db():
    """
    Verify Supabase connection.
    Tables must be created manually in the Supabase SQL Editor
    (run Backend/db/schema.sql once).
    """
    client = _get_client()
    if not client:
        logger.info("No Supabase credentials — using in-memory cache.")
        return
    try:
        # Lightweight ping: list up to 1 row from gee_cache
        client.table("gee_cache").select("query_hash").limit(1).execute()
        logger.info("✅ Supabase connection verified (AgriWatch KE).")
    except Exception as e:
        logger.warning(
            f"Supabase ping failed ({e}). "
            "Make sure you have run db/schema.sql in the Supabase SQL Editor."
        )


def _get_hash(func_name: str, *args, **kwargs) -> str:
    s = f"{func_name}_{args}_{kwargs}"
    return hashlib.md5(s.encode()).hexdigest()


def get_cached(func_name: str, *args, max_age_days: int = 14, **kwargs) -> Optional[Any]:
    """Return cached result or None. Same signature as the original SQLite version."""
    h = _get_hash(func_name, *args, **kwargs)

    client = _get_client()
    if client:
        try:
            response = (
                client.table("gee_cache")
                .select("data, created_at")
                .eq("query_hash", h)
                .maybe_single()
                .execute()
            )
            if response.data:
                created_at_str = response.data["created_at"]
                # Parse ISO timestamp
                created_at = datetime.fromisoformat(
                    created_at_str.replace("Z", "+00:00")
                )
                age_days = (
                    datetime.now(timezone.utc) - created_at
                ).total_seconds() / 86400.0
                if age_days < max_age_days:
                    raw = response.data["data"]
                    # Supabase returns JSONB as dict already
                    return raw if isinstance(raw, dict) else json.loads(raw)
        except Exception as e:
            logger.error(f"Cache read error: {e}")

    # Fallback: in-memory
    if h in _memory_cache:
        data, ts = _memory_cache[h]
        if (time.time() - ts) / 86400 < max_age_days:
            return data

    return None


def set_cached(func_name: str, result: Any, *args, **kwargs):
    """Store result in cache. Same signature as the original SQLite version."""
    if result is None:
        return
    h = _get_hash(func_name, *args, **kwargs)

    client = _get_client()
    if client:
        try:
            client.table("gee_cache").upsert(
                {
                    "query_hash": h,
                    "data": result,         # Supabase handles dict → JSONB
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="query_hash",
            ).execute()
            return
        except Exception as e:
            logger.error(f"Cache write error: {e}")

    # Fallback: in-memory
    _memory_cache[h] = (result, time.time())


def log_alert(
    county: str,
    crop: str,
    year: int,
    predicted_yield: float,
    baseline_yield: float,
    deviation_pct: float,
    alert_level: str,
):
    """Persist a yield alert to the Supabase audit trail (non-fatal if unavailable)."""
    client = _get_client()
    if not client:
        return
    try:
        client.table("yield_alerts").insert(
            {
                "county":          county,
                "crop":            crop,
                "year":            year,
                "predicted_yield": predicted_yield,
                "baseline_yield":  baseline_yield,
                "deviation_pct":   deviation_pct,
                "alert_level":     alert_level,
                "created_at":      datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    except Exception as e:
        logger.debug(f"Alert log error (non-fatal): {e}")


# Initialise on import (runs once when FastAPI loads the module)
init_db()
