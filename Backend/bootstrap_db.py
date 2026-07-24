# AgriWatch KE — Database Bootstrap Script
# © 2026 Cynthia Anguza. All Rights Reserved.
# IGAD Hackathon 2026 Submission.
#
# Run ONCE after creating the tables in Supabase SQL Editor to:
#   1. Verify environment variables and Supabase connection
#   2. Seed AFA historical data from CSV into Supabase
#
# Usage:
#   cd Backend
#   python bootstrap_db.py

import os
import sys
import csv
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv
    load_dotenv()
    logger.info(".env loaded.")
except ImportError:
    pass


def check_env():
    required = {
        "GEMINI_API_KEY":    "Google Gemini API key",
        "SUPABASE_URL":      "Supabase project URL",
        "SUPABASE_SECRET_KEY": "Supabase secret key",
        "GEE_PROJECT":       "Google Earth Engine project ID",
    }
    missing = {k: v for k, v in required.items() if not os.environ.get(k)}
    if missing:
        logger.error("Missing required environment variables:")
        for k, desc in missing.items():
            logger.error(f"  {k}  ({desc})")
        logger.error("Edit Backend/.env and fill in the missing values.")
        sys.exit(1)
    logger.info("✅ All required environment variables are present.")


def seed_afa_data():
    afa_path = Path(__file__).parent / "data" / "afa_official_stats.csv"
    if not afa_path.exists():
        logger.warning(f"AFA CSV not found at {afa_path} — skipping.")
        return

    try:
        from supabase import create_client
    except ImportError:
        logger.error("supabase not installed. Run: pip install supabase")
        sys.exit(1)

    client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SECRET_KEY"],
    )

    rows = []
    with open(afa_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append({
                "county":          row["county"],
                "crop":            row["crop"],
                "year":            int(row["year"]),
                "area_ha":         float(row["area_ha"]),
                "yield_tha":       float(row["yield_tha"]),
                "production_tons": float(row["production_tons"]),
            })

    # Upsert in batches of 200 (Supabase REST limit)
    batch_size = 200
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        client.table("afa_stats").upsert(
            batch, on_conflict="county,crop,year"
        ).execute()
        total += len(batch)
        logger.info(f"  Seeded {total}/{len(rows)} rows...")

    logger.info(f"✅ AFA data seeded — {total} records in Supabase.")


if __name__ == "__main__":
    check_env()

    # Verify Supabase connection (init_db pings the table)
    from services.cache_service import init_db
    init_db()

    seed_afa_data()
    logger.info("✅ Bootstrap complete. Run: uvicorn main:app --reload")
