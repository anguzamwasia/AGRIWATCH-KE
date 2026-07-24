# AgriWatch KE — Pre-extract TIF baselines into Supabase
# © 2026 Cynthia Anguza. All Rights Reserved.
#
# Run ONCE locally. Reads the processed SpamCast TIF files,
# extracts county-level area and yield baselines for all 4 crops,
# and stores them in Supabase afa_stats (or a new tif_baselines table).
# After this, the server never needs the TIF files at runtime.
#
# Usage:
#   cd Backend
#   python extract_tif_baselines.py

import os
import sys
import json
import logging
import numpy as np
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── TIF file locations (in the old project, used locally only) ──────────────
TIF_BASE = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data\processed")
SHAPEFILE = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data\boundaries\ken_admbnda_adm2_iebc_20191031.shp")

CROPS = {
    "Maize":      ("kenya_H_MAIZ.tif", "kenya_Y_MAIZ.tif"),
    "Wheat":      ("kenya_H_WHEA.tif", "kenya_Y_WHEA.tif"),
    "Potatoes":   ("kenya_H_POTA.tif", "kenya_Y_POTA.tif"),
    "Pigeonpeas": ("kenya_H_PIGE.tif", "kenya_Y_PIGE.tif"),
}


def extract_county_baselines():
    """Extract county-level area and yield from all 8 TIF files."""
    try:
        import geopandas as gpd
        import rasterio
        from rasterio.mask import mask as rio_mask
    except ImportError:
        logger.error("Missing: pip install geopandas rasterio")
        sys.exit(1)

    if not SHAPEFILE.exists():
        logger.error(f"Shapefile not found: {SHAPEFILE}")
        sys.exit(1)

    logger.info("Loading county shapefile...")
    gdf = gpd.read_file(SHAPEFILE)
    gdf["county"] = gdf["ADM1_EN"].str.strip()

    results = []

    for crop_name, (h_file, y_file) in CROPS.items():
        h_path = TIF_BASE / h_file
        y_path = TIF_BASE / y_file

        if not h_path.exists() or not y_path.exists():
            logger.warning(f"TIF files not found for {crop_name} — skipping.")
            continue

        logger.info(f"Extracting {crop_name}...")

        with rasterio.open(h_path) as src_h, rasterio.open(y_path) as src_y:
            # Group by county (dissolve subcounties)
            county_groups = gdf.dissolve(by="county").reset_index()

            for _, row in county_groups.iterrows():
                county = row["county"]
                geom = [row.geometry]

                try:
                    # Harvested area (ha)
                    out_h, _ = rio_mask(src_h, geom, crop=True, nodata=0)
                    h_data = out_h[0][out_h[0] > 0]
                    area_ha = float(np.sum(h_data)) if len(h_data) > 0 else 0.0

                    # Yield (kg/ha → t/ha)
                    out_y, _ = rio_mask(src_y, geom, crop=True, nodata=0)
                    y_data = out_y[0][out_y[0] > 0]
                    yield_tha = float(np.mean(y_data)) / 1000.0 if len(y_data) > 0 else 0.0

                    production_tons = area_ha * yield_tha

                    results.append({
                        "county":          county,
                        "crop":            crop_name,
                        "year":            2017,          # SpamCast 2017 baseline
                        "area_ha":         round(area_ha, 2),
                        "yield_tha":       round(yield_tha, 4),
                        "production_tons": round(production_tons, 2),
                        "source":          "SpamCast_TIF_2017",
                    })

                except Exception as e:
                    logger.warning(f"  {county} / {crop_name}: {e}")

        logger.info(f"  → {crop_name}: extracted {len([r for r in results if r['crop']==crop_name])} counties")

    return results


def save_to_json(results):
    """Save a local JSON backup (never commit this)."""
    out_path = Path(__file__).parent / "data" / "tif_baselines_2017.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    logger.info(f"✅ Local backup saved: {out_path}")


def upload_to_supabase(results):
    """Upsert extracted baselines into Supabase afa_stats (year=2017)."""
    try:
        from supabase import create_client
    except ImportError:
        logger.error("Run: pip install supabase")
        sys.exit(1)

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        logger.error("SUPABASE_URL and SUPABASE_SECRET_KEY required in .env")
        sys.exit(1)

    client = create_client(url, key)

    # Strip internal 'source' field before upsert
    rows = [{k: v for k, v in r.items() if k != "source"} for r in results]

    batch_size = 100
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        client.table("afa_stats").upsert(
            batch, on_conflict="county,crop,year"
        ).execute()
        total += len(batch)

    logger.info(f"✅ Uploaded {total} TIF baseline records to Supabase.")


if __name__ == "__main__":
    logger.info("Extracting county baselines from SpamCast TIF files...")
    results = extract_county_baselines()

    if not results:
        logger.error("No data extracted. Check TIF file paths.")
        sys.exit(1)

    logger.info(f"Total extracted: {len(results)} county-crop records")

    # Save local backup
    save_to_json(results)

    # Upload to Supabase
    upload_to_supabase(results)

    logger.info("")
    logger.info("✅ Done! The server no longer needs TIF files at runtime.")
    logger.info("   TIF files stay on your local machine — completely private.")
