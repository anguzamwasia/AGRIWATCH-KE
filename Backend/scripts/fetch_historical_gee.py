import ee
import geopandas as gpd
import pandas as pd
import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

V1_DATA_DIR = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data")
V2_BASE_DIR = Path(__file__).parent.parent
PROCESSED_DIR = V2_BASE_DIR / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

BOUNDARY_FILE = V1_DATA_DIR / "boundaries" / "ken_admbnda_adm2_iebc_20191031.shp"
OUTPUT_CSV = PROCESSED_DIR / "historical_climate_data.csv"

def init_gee():
    try:
        # The user provided a project id
        ee.Initialize(project='ee-penguincynthia')
        logger.info("Successfully initialized Earth Engine.")
    except Exception as e:
        logger.error(f"Failed to initialize Earth Engine: {e}")
        logger.info("Falling back to authentication. Please click the link if it appears.")
        try:
            ee.Authenticate()
            ee.Initialize(project='ee-penguincynthia')
        except Exception as e2:
            logger.error(f"Authentication failed: {e2}")
            raise

def gdf_to_ee_fc(gdf):
    """Converts a simplified GeoDataFrame to an Earth Engine FeatureCollection."""
    # Simplify geometry to avoid payload size limit
    gdf_sim = gdf.copy()
    gdf_sim['geometry'] = gdf_sim.geometry.simplify(tolerance=0.05, preserve_topology=True)
    
    features = []
    for _, row in gdf_sim.iterrows():
        geom = row.geometry
        if geom.is_empty:
            continue
            
        # Convert shapely geometry to geojson format
        if geom.geom_type == 'Polygon':
            coords = [list(geom.exterior.coords)]
            ee_geom = ee.Geometry.Polygon(coords)
        elif geom.geom_type == 'MultiPolygon':
            coords = [[list(poly.exterior.coords)] for poly in geom.geoms]
            ee_geom = ee.Geometry.MultiPolygon(coords)
        else:
            continue
            
        feat = ee.Feature(ee_geom, {
            'county': row['ADM1_EN'],
            'subcounty': row['ADM2_EN']
        })
        features.append(feat)
        
    return ee.FeatureCollection(features)

def fetch_historical_data():
    logger.info("Loading shapefile...")
    gdf = gpd.read_file(BOUNDARY_FILE).to_crs("EPSG:4326")
    fc = gdf_to_ee_fc(gdf)
    logger.info("Converted shapefile to EE FeatureCollection.")
    
    # We will fetch 10 years (2015-2024)
    years = range(2015, 2025)
    months = range(1, 13)
    
    results = []
    
    # Datasets
    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    lst = ee.ImageCollection("MODIS/061/MOD11A2")
    ndvi = ee.ImageCollection("MODIS/061/MOD13Q1")
    terraclimate = ee.ImageCollection("IDAHO_EPSCOR/TERRACLIMATE")
    
    for year in years:
        logger.info(f"Processing year {year}...")
        for month in months:
            start_date = f"{year}-{month:02d}-01"
            if month == 12:
                end_date = f"{year+1}-01-01"
            else:
                end_date = f"{year}-{month+1:02d}-01"
                
            # Rainfall (sum over month)
            rain = chirps.filterDate(start_date, end_date).sum().rename('rainfall')
            
            # Temperature (mean over month, scale factor 0.02, convert to Celsius)
            temp = lst.filterDate(start_date, end_date).select('LST_Day_1km').mean().multiply(0.02).subtract(273.15).rename('temp')
            
            # NDVI (mean over month, scale factor 0.0001)
            ndv = ndvi.filterDate(start_date, end_date).select('NDVI').mean().multiply(0.0001).rename('ndvi')
            
            # Moisture (mean over month)
            moist = terraclimate.filterDate(start_date, end_date).select('soil').mean().multiply(0.1).rename('moisture')
            
            # Combine into a single image
            img = ee.Image.cat([rain, temp, ndv, moist])
            
            # Reduce regions
            reduced = img.reduceRegions(
                collection=fc,
                reducer=ee.Reducer.mean(),
                scale=5000 # Use 5km scale to speed up
            )
            
            # Get data
            data = reduced.getInfo()['features']
            for f in data:
                props = f['properties']
                results.append({
                    'year': year,
                    'month': month,
                    'county': props.get('county'),
                    'subcounty': props.get('subcounty'),
                    'rainfall': props.get('rainfall', 0),
                    'temp': props.get('temp', 0),
                    'ndvi': props.get('ndvi', 0),
                    'moisture': props.get('moisture', 0)
                })
                
    df = pd.DataFrame(results)
    df.to_csv(OUTPUT_CSV, index=False)
    logger.info(f"Successfully saved {len(df)} records to {OUTPUT_CSV}")

if __name__ == "__main__":
    init_gee()
    fetch_historical_data()
