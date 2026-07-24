import geopandas as gpd
import rasterio
import rasterio.mask
import numpy as np
import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Paths
V1_DATA_DIR = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data")
V2_BASE_DIR = Path(__file__).parent.parent
PROCESSED_DIR = V2_BASE_DIR / "data" / "processed"
OUTPUT_JSON = V2_BASE_DIR.parent / "Frontend" / "src" / "data" / "base_crops_stats.json"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

BOUNDARY_FILE = V1_DATA_DIR / "boundaries" / "ken_admbnda_adm2_iebc_20191031.shp"
RAW_DIR = V1_DATA_DIR / "raw"

CROPS = {"MAIZ": "Maize", "PIGE": "Pigeonpeas", "POTA": "Potatoes", "WHEA": "Wheat"}
# Variables: A = Physical Area, H = Harvested Area, Y = Yield
VARS = ["A", "H", "Y"]

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.generic): return obj.item()
        if isinstance(obj, np.ndarray): return obj.tolist()
        return super().default(obj)

def process_spam():
    logger.info("Loading Subcounties...")
    gdf = gpd.read_file(BOUNDARY_FILE).to_crs("EPSG:4326")
    
    data = {"national": {}, "counties": {}}
    
    # Initialize structures
    for c_name in CROPS.values():
        data["national"][c_name] = {"area_planted_ha": 0, "area_harvested_ha": 0, "production_tons": 0}
        
    for _, row in gdf.iterrows():
        county = row['ADM1_EN']
        subcounty = row['ADM2_EN']
        geom = [row.geometry]
        
        if county not in data["counties"]:
            data["counties"][county] = {"county_summary": {}, "subcounties": {}}
            for c_name in CROPS.values():
                data["counties"][county]["county_summary"][c_name] = {"area_planted_ha": 0, "area_harvested_ha": 0, "production_tons": 0}
                
        if subcounty not in data["counties"][county]["subcounties"]:
            data["counties"][county]["subcounties"][subcounty] = {}
            for c_name in CROPS.values():
                data["counties"][county]["subcounties"][subcounty][c_name] = {"area_planted_ha": 0, "area_harvested_ha": 0, "production_tons": 0}
                
        # Process each crop
        for c_code, c_name in CROPS.items():
            try:
                # Load A, H, Y
                if c_name == "Maize":
                    a_file = RAW_DIR / "maize_physical_0.1km.tif"
                    h_file = RAW_DIR / "maize_harvest_0.1km.tif"
                    y_file = RAW_DIR / "maize_yield_0.1km.tif"
                else:
                    a_file = RAW_DIR / f"spam2017V2r1_SSA_A_{c_code}_A_0.5km.tif"
                    h_file = RAW_DIR / f"spam2017V2r1_SSA_H_{c_code}_A_0.5km.tif"
                    y_file = RAW_DIR / f"spam2017V2r1_SSA_Y_{c_code}_A_0.5km.tif"
                
                if not all(f.exists() for f in [a_file, h_file, y_file]):
                    continue
                    
                with rasterio.open(a_file) as src_a, rasterio.open(h_file) as src_h, rasterio.open(y_file) as src_y:
                    a_img, _ = rasterio.mask.mask(src_a, geom, crop=True, nodata=0)
                    h_img, _ = rasterio.mask.mask(src_h, geom, crop=True, nodata=0)
                    y_img, _ = rasterio.mask.mask(src_y, geom, crop=True, nodata=0)
                    
                    a_data, h_data, y_data = a_img[0], h_img[0], y_img[0]
                    a_data[a_data < 0] = 0
                    h_data[h_data < 0] = 0
                    y_data[y_data < 0] = 0
                    
                    if c_name == "Maize":
                        # The user's 1km TIF was upsampled from 10km (100x area) without scaling
                        a_data = a_data / 100.0
                        h_data = h_data / 100.0
                    area_planted = np.nansum(a_data)
                    area_harvested = np.nansum(h_data)
                    production = np.nansum(h_data * y_data) / 1000 # kg to tons (SPAM yield is kg/ha)
                    
                    # Subcounty
                    data["counties"][county]["subcounties"][subcounty][c_name] = {
                        "area_planted_ha": round(area_planted, 2),
                        "area_harvested_ha": round(area_harvested, 2),
                        "production_tons": round(production, 2),
                        "yield_tha": round(production / area_harvested, 2) if area_harvested > 0 else 0
                    }
                    
                    # County
                    data["counties"][county]["county_summary"][c_name]["area_planted_ha"] += area_planted
                    data["counties"][county]["county_summary"][c_name]["area_harvested_ha"] += area_harvested
                    data["counties"][county]["county_summary"][c_name]["production_tons"] += production
                    
                    # National
                    data["national"][c_name]["area_planted_ha"] += area_planted
                    data["national"][c_name]["area_harvested_ha"] += area_harvested
                    data["national"][c_name]["production_tons"] += production
            except Exception as e:
                pass

    # Finalize aggregates
    for county, c_data in data["counties"].items():
        for c_name in CROPS.values():
            a_p = c_data["county_summary"][c_name]["area_planted_ha"]
            a_h = c_data["county_summary"][c_name]["area_harvested_ha"]
            p = c_data["county_summary"][c_name]["production_tons"]
            
            c_data["county_summary"][c_name]["area_planted_ha"] = round(a_p, 2)
            c_data["county_summary"][c_name]["area_harvested_ha"] = round(a_h, 2)
            c_data["county_summary"][c_name]["production_tons"] = round(p, 2)
            c_data["county_summary"][c_name]["yield_tha"] = round(p / a_h, 2) if a_h > 0 else 0
            
    for c_name in CROPS.values():
        a_p = data["national"][c_name]["area_planted_ha"]
        a_h = data["national"][c_name]["area_harvested_ha"]
        p = data["national"][c_name]["production_tons"]
        
        data["national"][c_name]["area_planted_ha"] = round(a_p, 2)
        data["national"][c_name]["area_harvested_ha"] = round(a_h, 2)
        data["national"][c_name]["production_tons"] = round(p, 2)
        data["national"][c_name]["yield_tha"] = round(p / a_h, 2) if a_h > 0 else 0

    with open(OUTPUT_JSON, 'w') as f:
        json.dump(data, f, indent=4, cls=NumpyEncoder)
        
    logger.info(f"Done: {OUTPUT_JSON.name}")

if __name__ == "__main__":
    process_spam()
