import os
import ee
import requests
import geopandas as gpd
from pathlib import Path
import time
from PIL import Image
from io import BytesIO

# Initialize EE
try:
    ee.Initialize(project='ee-penguincynthia')
except Exception as e:
    print("EE Auth failed, please authenticate:", e)
    ee.Authenticate()
    ee.Initialize(project='ee-penguincynthia')

# Load local boundary
boundary_file = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data\boundaries\ken_admbnda_adm2_iebc_20191031.shp")
gdf = gpd.read_file(boundary_file)

# Output directory
out_dir = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data\processed\lulc")
out_dir.mkdir(parents=True, exist_ok=True)

# Colors for Dynamic World
palette = ['419BDF', '397D49', '88B053', '7A87C6', 'E49635', 'DFC35A', 'C4281B', 'A59B8F', 'B39FE1']

counties = ["Kenya"] + list(gdf['ADM1_EN'].unique())

for year in range(2017, 2027):
    query_year = min(year, 2024) # Dynamic World ends ~2024 right now, but we label it as requested
    start_date = f"{query_year}-01-01"
    end_date = f"{query_year+1}-01-01"
    
    year_dir = out_dir / str(year)
    year_dir.mkdir(exist_ok=True)
    
    print(f"Downloading LULC for {year}...")
    for county in counties:
        out_path = year_dir / f"{county.replace(' ', '_')}.png"
        if out_path.exists():
            continue
            
        print(f"  Fetching {county}...")
        try:
            if county == "Kenya":
                target_gdf = gdf
            else:
                target_gdf = gdf[gdf['ADM1_EN'] == county]
                
            geom_coords = [list(c) for c in target_gdf.unary_union.convex_hull.exterior.coords]
            ee_geom = ee.Geometry.Polygon([geom_coords])
            
            dw = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1") \
                .filterBounds(ee_geom) \
                .filterDate(start_date, end_date) \
                .select('label') \
                .mode() \
                .clip(ee_geom)
                
            url = dw.getThumbURL({
                'min': 0, 'max': 8,
                'palette': palette,
                'dimensions': 1000,
                'region': ee_geom,
                'format': 'png'
            })
            
            res = requests.get(url, timeout=30)
            if res.status_code == 200:
                with open(out_path, 'wb') as f:
                    f.write(res.content)
            else:
                print(f"    Failed HTTP {res.status_code}")
                
            time.sleep(0.5)
        except Exception as e:
            print(f"    Error on {county}: {e}")

print("LULC Download Complete.")
