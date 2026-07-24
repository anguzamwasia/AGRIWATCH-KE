from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional, Any
import json
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
import xgboost as xgb
import pandas as pd
from pathlib import Path
from datetime import datetime
from services.earth_engine_service import ee_service

load_dotenv()

app = FastAPI(title="Kenya Yield Insight API V2", description="XGBoost + Earth Engine")

app.mount("/images", StaticFiles(directory="images"), name="images")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

V2_BASE_DIR = Path(__file__).parent
STATS_FILE = V2_BASE_DIR.parent / "Frontend" / "src" / "data" / "base_crops_stats.json"
MODEL_FILE = V2_BASE_DIR / "models" / "saved" / "xgb_yield_model.json"
FEATURES_FILE = V2_BASE_DIR / "models" / "saved" / "features.json"

# Setup Gemini
gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

xgb_model = None
feature_cols = []
stats_data = {}


@app.on_event("startup")
def load_assets():
    global xgb_model, feature_cols, stats_data, afa_data_cache
    
    if STATS_FILE.exists():
        with open(STATS_FILE, 'r') as f:
            stats_data = json.load(f)
            
    afa_data_cache = {}
    afa_file = V2_BASE_DIR / "data" / "afa_official_stats.csv"
    if afa_file.exists():
        df = pd.read_csv(afa_file)
        for _, row in df.iterrows():
            c = row['county']
            cr = row['crop']
            y = int(row['year'])
            if c not in afa_data_cache:
                afa_data_cache[c] = {}
            if cr not in afa_data_cache[c]:
                afa_data_cache[c][cr] = {'mean': {'area': 0, 'yield': 0, 'count': 0}}
            
            afa_data_cache[c][cr][y] = {"area": row['area_ha'], "yield": row['yield_tha'], "prod": row['production_tons']}
            afa_data_cache[c][cr]['mean']['area'] += row['area_ha']
            afa_data_cache[c][cr]['mean']['yield'] += row['yield_tha']
            afa_data_cache[c][cr]['mean']['count'] += 1

    if MODEL_FILE.exists() and FEATURES_FILE.exists():
        xgb_model = xgb.XGBRegressor()
        xgb_model.load_model(MODEL_FILE)
        with open(FEATURES_FILE, 'r') as f:
            feature_cols = json.load(f)

potato_baseline_cache = {}

def _get_potato_tif_baseline(county: str):
    # Official stats from base_crops_stats.json are now used, so we return 0.0 here
    return 0.0, 0.0


def _get_afa_baseline(county, crop):
    if county in afa_data_cache and crop in afa_data_cache[county]:
        m = afa_data_cache[county][crop]['mean']
        if m['count'] > 0:
            return m['area']/m['count'], m['yield']/m['count']
    if crop == "Potatoes":
        return _get_potato_tif_baseline(county)
    return 0.0, 0.0

@app.get("/api/bounds")
def get_bounds(county: str, subcounty: Optional[str] = ""):
    try:
        from map_service import _get_kenya_raw_gdf
        gdf = _get_kenya_raw_gdf()

        is_national = county.lower() in ["kenya", "country", ""]
        has_subcounty = subcounty and subcounty not in ["", "Select subcounty"]

        if is_national:
            target_gdf = gdf
            # Dissolve by shapeName (county) to keep individual county outlines
            geom_gdf = target_gdf[["shapeName", "geometry"]].to_crs(epsg=4326).dissolve(by="shapeName").reset_index()
        elif has_subcounty:
            target_gdf = gdf[
                (gdf['shapeName'].str.lower() == county.lower()) &
                (gdf['ADM2_EN'].str.lower() == subcounty.lower())
            ]
            if target_gdf.empty:
                target_gdf = gdf[gdf['shapeName'].str.lower() == county.lower()]
            # Keep the individual subcounty polygon as-is
            geom_gdf = target_gdf[["geometry"]].to_crs(epsg=4326)
        else:
            # County level — dissolve all subcounty rows into one outer polygon
            target_gdf = gdf[gdf['shapeName'].str.lower() == county.lower()]
            if target_gdf.empty:
                return {"bounds": None, "geojson": None}
            geom_gdf = target_gdf[["geometry"]].to_crs(epsg=4326).dissolve().reset_index(drop=True)

        if target_gdf.empty:
            return {"bounds": None, "geojson": None}

        # Compute bounding box from the (possibly dissolved) geom
        bounds = geom_gdf.geometry.union_all().bounds
        # Leaflet expects [[south, west], [north, east]]
        leaflet_bounds = [[bounds[1], bounds[0]], [bounds[3], bounds[2]]]

        import json
        geojson_data = json.loads(geom_gdf.to_json())

        return {
            "bounds": leaflet_bounds,
            "geojson": geojson_data
        }
    except Exception as e:
        print("Error getting bounds:", e)
        return {"bounds": None, "geojson": None}

@app.get("/api/locations")
def get_locations():
    counties = list(stats_data.get("counties", {}).keys())
    counties.sort()
    
    mapping = {}
    for c, c_data in stats_data.get("counties", {}).items():
        subs = list(c_data.get("subcounties", {}).keys())
        subs.sort()
        mapping[c] = subs
        
    return {"counties": counties, "mapping": mapping}


def _get_baseline(county: str, subcounty: str, crop: str):
    total_area = 0
    total_prod = 0
    if county == "Kenya":
        nat_data = stats_data.get("national", {}).get(crop, {})
        total_area = nat_data.get("area_harvested_ha", 0)
        total_prod = nat_data.get("production_tons", 0)
    elif subcounty == "":
        c_data = stats_data.get("counties", {}).get(county, {})
        for s, s_data in c_data.get("subcounties", {}).items():
            cd = s_data.get(crop, {})
            total_area += cd.get("area_harvested_ha", 0)
            total_prod += cd.get("production_tons", 0)
    else:
        cd = stats_data.get("counties", {}).get(county, {}).get("subcounties", {}).get(subcounty, {}).get(crop, {})
        total_area = cd.get("area_harvested_ha", 0)
        total_prod = cd.get("production_tons", 0)
        

        
    avg_yield = total_prod / total_area if total_area > 0 else 0
    return {"area_harvested_ha": total_area, "production_tons": total_prod, "yield_tha": avg_yield}

def _get_total_baseline_area(county: str, subcounty: str):
    total_area = 0
    if county == "Kenya":
        for c, c_data in stats_data.get("counties", {}).items():
            for s, s_data in c_data.get("subcounties", {}).items():
                for crop_name, cd in s_data.items():
                    total_area += cd.get("area_harvested_ha", 0)
    elif subcounty == "":
        c_data = stats_data.get("counties", {}).get(county, {})
        for s, s_data in c_data.get("subcounties", {}).items():
            for crop_name, cd in s_data.items():
                total_area += cd.get("area_harvested_ha", 0)
    else:
        s_data = stats_data.get("counties", {}).get(county, {}).get("subcounties", {}).get(subcounty, {})
        for crop_name, cd in s_data.items():
            total_area += cd.get("area_harvested_ha", 0)
    return total_area


@app.get("/api/yield-analysis")
def get_yield_analysis(county: str, subcounty: str, year: int, crop: str = "Maize"):
    baseline = _get_baseline(county, subcounty, crop)
    base_yield = baseline.get("yield_tha", 0)
    base_area = baseline.get("area_harvested_ha", 0)
    
    afa_area, afa_yield = _get_afa_baseline(county, crop)
    current_area = afa_area if afa_area > 0 and subcounty == "" else base_area

    if current_area == 0:
        return {
            "status": "success",
            "location": f"{subcounty}, {county}" if subcounty else county,
            "cards": {
                "predicted_yield": 0, "production": 0, "area_ha": 0, "rainfall": 0, "temp": 0, "is_predicted": False
            }
        }
        
    ee_data = ee_service.get_predictors(county, subcounty, year)
    predicted_yield = float(base_yield)
    is_predicted = False
    
    # AFA Ground Truth Override for 2021-2025
    if 2021 <= year <= 2025 and subcounty == "":
        if county == "Kenya":
            total_afa_prod = 0
            total_afa_area = 0
            has_afa = False
            for c_name in stats_data.get("counties", {}).keys():
                if c_name in afa_data_cache and crop in afa_data_cache[c_name] and year in afa_data_cache[c_name][crop]:
                    afa_row = afa_data_cache[c_name][crop][year]
                    total_afa_prod += afa_row['prod']
                    total_afa_area += afa_row['area']
                    has_afa = True
            
            if has_afa and total_afa_area > 0:
                cards = {
                    "predicted_yield": total_afa_prod / total_afa_area,
                    "production": total_afa_prod,
                    "area_ha": total_afa_area,
                    "rainfall": ee_data.get("annual", {}).get("rainfall", 0) if ee_data else 0,
                    "temp": ee_data.get("annual", {}).get("temp", 0) if ee_data else 0,
                    "is_predicted": False
                }
                return {
                    "status": "success",
                    "location": "Kenya",
                    "cards": cards,
                    "charts": ee_data.get("monthly", []) if ee_data else [],
                    "mapData": ee_data.get("stats", {}) if ee_data else {}
                }
        else:
            if county in afa_data_cache and crop in afa_data_cache[county] and year in afa_data_cache[county][crop]:
                afa_row = afa_data_cache[county][crop][year]
                cards = {
                    "predicted_yield": afa_row['yield'],
                    "production": afa_row['prod'],
                    "area_ha": afa_row['area'],
                    "rainfall": ee_data.get("annual", {}).get("rainfall", 0) if ee_data else 0,
                    "temp": ee_data.get("annual", {}).get("temp", 0) if ee_data else 0,
                    "is_predicted": False
                }
                return {
                    "status": "success",
                    "location": county,
                    "cards": cards,
                    "charts": ee_data.get("monthly", []) if ee_data else [],
                    "mapData": ee_data.get("stats", {}) if ee_data else {}
                }
    
    if ee_data and xgb_model:
        ann = ee_data.get("annual", {})
        input_data = {
            'rainfall': ann.get('rainfall', 0),
            'temp': ann.get('temp', 0),
            'ndvi': ann.get('ndvi', 0),
            'moisture': ann.get('moisture', 0),
            'base_area': base_area,
            'base_yield': base_yield,
            'afa_area': afa_area,
            'afa_yield': afa_yield
        }
        for c in feature_cols:
            if c.startswith('crop_'):
                input_data[c] = 1 if c == f"crop_{crop}" else 0
            elif c.startswith('county_'):
                input_data[c] = 1 if c == f"county_{county}" else 0
                
        import pandas as pd
        if county == "Kenya":
            try:
                total_pred_prod = 0
                total_pred_area = 0
                for c_name in stats_data.get("counties", {}).keys():
                    c_afa_a, c_afa_y = _get_afa_baseline(c_name, crop)
                    
                    c_input = input_data.copy()
                    c_input['afa_area'] = c_afa_a
                    c_input['afa_yield'] = c_afa_y
                    
                    for c_col in feature_cols:
                        if c_col.startswith('county_'):
                            c_input[c_col] = 1 if c_col == f"county_{c_name}" else 0
                            
                    c_df_in = pd.DataFrame([c_input])
                    for col in feature_cols:
                        if col not in c_df_in.columns: c_df_in[col] = 0
                    c_df_in = c_df_in[feature_cols]
                    
                    c_yield = max(0.0, float(xgb_model.predict(c_df_in)[0]))
                    
                    # Use AFA area if available, else fallback to TIF baseline
                    c_area_use = c_afa_a if c_afa_a > 0 else _get_total_baseline_area(c_name, "")
                    total_pred_prod += c_yield * c_area_use
                    total_pred_area += c_area_use
                    
                if total_pred_area > 0:
                    predicted_yield = total_pred_prod / total_pred_area
                else:
                    predicted_yield = 0.0
                is_predicted = True
            except Exception as e:
                print(f"XGBoost National Prediction Error: {e}")
                pass
        else:
            df_in = pd.DataFrame([input_data])
            for col in feature_cols:
                if col not in df_in.columns: df_in[col] = 0
            df_in = df_in[feature_cols]
            try:
                predicted_yield = max(0.0, float(xgb_model.predict(df_in)[0]))
                is_predicted = True
            except Exception as e:
                print(f"XGBoost Prediction Error: {e}")
                pass
            
    cards = {
        "predicted_yield": predicted_yield,
        "production": predicted_yield * current_area,
        "area_ha": current_area,
        "rainfall": ee_data.get("annual", {}).get("rainfall", 0) if ee_data else 0,
        "temp": ee_data.get("annual", {}).get("temp", 0) if ee_data else 0,
        "is_predicted": is_predicted
    }
    
    return {
        "status": "success",
        "location": f"{subcounty}, {county}" if subcounty else county,
        "cards": cards,
        "charts": ee_data.get("monthly", []) if ee_data else [],
        "mapData": ee_data.get("stats", {}) if ee_data else {}
    }

@app.get("/api/analytics/predictors")
def get_predictors(county: str, subcounty: str, year: int, crop: str = "Maize"):
    data = ee_service.get_predictors(county, subcounty, year, crop)
    if not data:
        raise HTTPException(status_code=404, detail="Data not found")
        
    try:
        from map_service import generate_county_map
        soil_map_filename = generate_county_map(county, crop, year, map_type='soil')
        data["mapPath"] = f"/images/{soil_map_filename}"
        
        lulc_map_filename = generate_county_map(county, crop, year, map_type='lulc')
        data["lulcMapPath"] = f"/images/{lulc_map_filename}"
    except Exception as e:
        print("Error generating maps:", e)
        
    return data

@app.get("/api/analytics/phenology")
def get_phenology(county: str, subcounty: str, year: int):
    data = ee_service.get_phenology(county, subcounty, year)
    if not data:
        raise HTTPException(status_code=404, detail="Data not found")
    return data

from fastapi.responses import FileResponse
import time as _time

@app.get("/api/yield-surface")
def get_yield_surface(county: str, year: int, crop: str = "Maize", subcounty: str = ""):
    """
    Returns a PNG heatmap of the crop yield/harvested-area distribution
    for the given county+crop+year, derived from TIF raster data.
    Used as an ImageOverlay in the Leaflet map.
    """
    try:
        filename = generate_county_map(county=county, crop=crop, year=year, map_type='crop', subcounty=subcounty)
        if not filename:
            raise HTTPException(status_code=404, detail="Map not generated")
        img_path = V2_BASE_DIR / "images" / filename
        if not img_path.exists():
            raise HTTPException(status_code=404, detail="Map file missing")
        # Return with cache-busting headers
        return FileResponse(
            str(img_path),
            media_type="image/png",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache"}
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"yield-surface error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
from typing import Optional, Any

@app.get("/api/yield-tif")
def get_yield_tif(county: str, year: int, crop: str = "Maize", subcounty: str = ""):
    """
    Returns the actual TIF file for client-side Georaster rendering.
    """
    try:
        from map_service import generate_county_tif
        filename = generate_county_tif(county=county, crop=crop, year=year, subcounty=subcounty)
        if not filename:
            raise HTTPException(status_code=404, detail="TIF not generated")
        
        tif_path = V2_BASE_DIR / "images" / filename
        if not tif_path.exists():
            raise HTTPException(status_code=404, detail="TIF file missing")
            
        return FileResponse(
            str(tif_path),
            media_type="image/tiff",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate", 
                "Pragma": "no-cache",
                "Access-Control-Allow-Origin": "*"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"yield-tif error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
from typing import Optional, Any

class EESoilRequest(BaseModel):
    layer: str = "texture"
    county: str = "Kenya"
    subcounty: str = ""

@app.post("/api/ee-soil-tile-url")
def get_ee_soil_tile_url(req: EESoilRequest):
    """
    Returns the Google Earth Engine tile url for the requested iSDAsoil layer.
    """
    import ee
    try:
        ee.Initialize(project='ee-penguincynthia')
    except Exception:
        pass # Already initialized in earth_engine_service
        
    try:
        layer = req.layer
        # Load iSDAsoil Assets (Official Verified Paths)
        if layer == 'clay':
            img = ee.Image("ISDASOIL/Africa/v1/clay_content").select('mean_0_20').divide(10).exp().subtract(1)
            vis = {'min': 10, 'max': 60, 'palette': ['white', 'blue']}
        elif layer == 'sand':
            img = ee.Image("ISDASOIL/Africa/v1/sand_content").select('mean_0_20').divide(10).exp().subtract(1)
            vis = {'min': 10, 'max': 80, 'palette': ['white', 'orange']}
        elif layer == 'ph':
            img = ee.Image("ISDASOIL/Africa/v1/ph").select('mean_0_20').divide(10)
            vis = {'min': 5, 'max': 8, 'palette': ['red', 'yellow', 'green']}
        elif layer == 'soc':
            img = ee.Image("ISDASOIL/Africa/v1/carbon_organic").select('mean_0_20').divide(10).exp().subtract(1)
            vis = {'min': 0, 'max': 50, 'palette': ['white', 'brown']}
        elif layer == 'nitrogen':
            img = ee.Image("ISDASOIL/Africa/v1/nitrogen_total").select('mean_0_20').divide(100).exp().subtract(1)
            vis = {'min': 0, 'max': 10, 'palette': ['white', 'purple']}
        elif layer == 'cec':
            img = ee.Image("ISDASOIL/Africa/v1/cation_exchange_capacity").select('mean_0_20').divide(10).exp().subtract(1)
            vis = {'min': 0, 'max': 40, 'palette': ['white', 'magenta']}
        elif layer == 'composite':
            clay = ee.Image("ISDASOIL/Africa/v1/clay_content").select('mean_0_20').divide(10).exp().subtract(1).rename('clay')
            sand = ee.Image("ISDASOIL/Africa/v1/sand_content").select('mean_0_20').divide(10).exp().subtract(1).rename('sand')
            soc = ee.Image("ISDASOIL/Africa/v1/carbon_organic").select('mean_0_20').divide(10).exp().subtract(1).rename('soc')
            img = ee.Image.cat([clay, sand, soc])
            vis = {'bands': ['clay', 'sand', 'soc'], 'min': [10, 10, 0], 'max': [60, 80, 50]}
        else: # texture or default
            img = ee.Image("ISDASOIL/Africa/v1/texture_class").select('texture_0_20')
            vis = {
                'min': 1, 'max': 12, 
                'palette': ['d5c36b', 'b96947', '9d3706', 'ae868f', 'f86714', '46d143', '368f20', '3e5a14', 'ffd557', 'fff72e', 'ff5a9d', 'ff005b']
            }
            
        county = req.county
        subcounty = req.subcounty
        if county and county.lower() != "kenya" and county.lower() != "country":
            try:
                from map_service import _get_kenya_raw_gdf
                from services.earth_engine_service import ee_service
                gdf = _get_kenya_raw_gdf()
                if subcounty and subcounty != "Select subcounty":
                    target_gdf = gdf[(gdf['shapeName'].str.lower() == county.lower()) & (gdf['ADM2_EN'].str.lower() == subcounty.lower())]
                    if target_gdf.empty: # Fallback to county if subcounty fails
                        target_gdf = gdf[gdf['shapeName'].str.lower() == county.lower()]
                else:
                    target_gdf = gdf[gdf['shapeName'].str.lower() == county.lower()]
                    
                if not target_gdf.empty:
                    ee_geom = ee_service._to_ee_geom(target_gdf.geometry.unary_union.simplify(0.01))
                    if ee_geom:
                        img = img.clip(ee_geom)
            except Exception as geom_e:
                print(f"Geometry clipping error: {geom_e}")
            
        mapid = img.getMapId(vis)
        return {"url": mapid['tile_fetcher'].url_format}
    except Exception as e:
        print(f"ee-soil-tile-url error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debug")
def get_debug():
    hist_file = V2_BASE_DIR / "data" / "processed" / "historical_climate_data.csv"
    return {
        "xgb_model_is_none": xgb_model is None,
        "hist_file_exists": hist_file.exists(),
        "afa_cache_len": len(afa_data_cache)
    }

def _get_county_trends(county: str, subcounty: str, crop: str, year: int = None, kenya_climate_override: dict = None):
    baseline = _get_baseline(county, subcounty, crop)
    base_yield = baseline.get("yield_tha", 0)
    base_area = baseline.get("area_harvested_ha", 0)
    
    hist_file = V2_BASE_DIR / "data" / "processed" / "historical_climate_data.csv"
    trends = []
    
    if hist_file.exists() and xgb_model:
        df = pd.read_csv(hist_file)
        if subcounty == "":
            sub_df = df[df['county'] == county]
        else:
            sub_df = df[(df['county'] == county) & (df['subcounty'] == subcounty)]
            
        if not sub_df.empty:
            spatial_avg = sub_df.groupby(['year', 'month']).mean(numeric_only=True).reset_index()
            ann_df = spatial_avg.groupby('year').agg({'rainfall':'sum', 'temp':'mean', 'ndvi':'mean', 'moisture':'mean'}).reset_index()
            
            if year and year > 2024:
                for y in range(2025, year + 1):
                    # If we are aggregating for Kenya, use the pre-calculated national climate to save 20 minutes of Earth Engine calls
                    if kenya_climate_override and y in kenya_climate_override:
                        ann = kenya_climate_override[y]
                        new_row = pd.DataFrame([{'year': y, 'rainfall': ann['rainfall'], 'temp': ann['temp'], 'ndvi': ann['ndvi'], 'moisture': ann['moisture']}])
                        ann_df = pd.concat([ann_df, new_row], ignore_index=True) if not ann_df.empty else new_row
                    else:
                        live_ee = ee_service.get_predictors(county, subcounty, y)
                        if live_ee:
                            ann = live_ee["annual"]
                            new_row = pd.DataFrame([{'year': y, 'rainfall': ann['rainfall'], 'temp': ann['temp'], 'ndvi': ann['ndvi'], 'moisture': ann['moisture']}])
                            ann_df = pd.concat([ann_df, new_row], ignore_index=True) if not ann_df.empty else new_row
            
            ann_df = ann_df[ann_df['year'] >= 2017]
            
            for _, row in ann_df.iterrows():
                row_year = int(row['year'])
                
                # AFA Ground Truth Injection
                if row_year >= 2021 and row_year <= 2025 and subcounty == "":
                    if county in afa_data_cache and crop in afa_data_cache[county] and row_year in afa_data_cache[county][crop]:
                        afa_row = afa_data_cache[county][crop][row_year]
                        # Only inject if AFA data is non-zero, otherwise let the AI model fill the gap
                        if afa_row['area'] > 0 and afa_row['yield'] > 0:
                            trends.append({
                                "year": row_year,
                                "yield_tha": round(afa_row['yield'], 2),
                                "production_tons": round(afa_row['prod'], 2),
                                "area_ha": round(afa_row['area'], 2),
                                "is_predicted": False
                            })
                            continue
                
                afa_area, afa_yield = _get_afa_baseline(county, crop)
                drift = 1.0 + ((row_year - 2017) * 0.005)
                current_area = (afa_area if afa_area > 0 and subcounty == "" else base_area) * drift
                
                input_data = {
                    'rainfall': row['rainfall'], 'temp': row['temp'], 'ndvi': row['ndvi'], 'moisture': row['moisture'],
                    'base_area': base_area, 'base_yield': base_yield, 'afa_area': afa_area, 'afa_yield': afa_yield
                }
                for c in feature_cols:
                    if c.startswith('crop_'):
                        input_data[c] = 1 if c == f"crop_{crop}" else 0
                    elif c.startswith('county_'):
                        input_data[c] = 1 if c == f"county_{county}" else 0
                
                df_in = pd.DataFrame([input_data])
                for col in feature_cols:
                    if col not in df_in.columns: df_in[col] = 0
                df_in = df_in[feature_cols]
                
                pred_y = max(0, float(xgb_model.predict(df_in)[0])) if current_area > 0 else 0.0
                
                trends.append({
                    "year": row_year,
                    "yield_tha": round(pred_y, 2),
                    "production_tons": round(pred_y * current_area, 2),
                    "area_ha": round(current_area, 2),
                    "is_predicted": True
                })
    return trends

@app.get("/api/analytics/trends")
def get_trends(county: str, subcounty: str, crop: str = "Maize", year: int = None):
    if county == "Kenya" and subcounty == "":
        kenya_climate_override = {}
        if year and year > 2024:
            for y in range(2025, year + 1):
                # Fetch the nationwide aggregated climate from Earth Engine (takes ~15 seconds total)
                live_ee = ee_service.get_predictors("Kenya", "", y)
                if live_ee:
                    kenya_climate_override[y] = live_ee["annual"]

        trends_dict = {}
        for c_name in stats_data.get("counties", {}).keys():
            c_trends = _get_county_trends(c_name, "", crop, year, kenya_climate_override)
            for t in c_trends:
                y = t["year"]
                if y not in trends_dict:
                    trends_dict[y] = {"area_ha": 0, "production_tons": 0, "is_predicted": False}
                trends_dict[y]["area_ha"] += t["area_ha"]
                trends_dict[y]["production_tons"] += t["production_tons"]
                if t["is_predicted"]:
                    trends_dict[y]["is_predicted"] = True
                    
        agg_trends = []
        for y in sorted(trends_dict.keys()):
            area = trends_dict[y]["area_ha"]
            prod = trends_dict[y]["production_tons"]
            yld = prod / area if area > 0 else 0
            agg_trends.append({
                "year": y,
                "yield_tha": round(yld, 2),
                "production_tons": round(prod, 2),
                "area_ha": round(area, 2),
                "is_predicted": trends_dict[y]["is_predicted"]
            })
        return {"status": "success", "trends": agg_trends}
    else:
        return {"status": "success", "trends": _get_county_trends(county, subcounty, crop, year)}

class MessageDict(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    context_county: str
    context_crop: str
    history: list[MessageDict] = []

import re
from map_service import generate_county_map

@app.post("/api/chat")
def handle_chat(req: ChatRequest):
    # Context statistics to ground Gemini
    context_stats = ""
    try:
        county_data = stats_data.get("counties", {}).get(req.context_county, {})
        crop_data = county_data.get("county_summary", {}).get(req.context_crop, {})
        if crop_data:
            context_stats = f"Baseline for {req.context_crop} in {req.context_county}: Yield: {crop_data.get('yield_tha')} t/ha, Production: {crop_data.get('production_tons')} tons, Area: {crop_data.get('area_harvested_ha')} ha.\n"
            
        for crop_name in ["Maize", "Wheat", "Potatoes", "Pigeonpeas"]:
            crop_totals = []
            for c, c_data in stats_data.get("counties", {}).items():
                prod = c_data.get("county_summary", {}).get(crop_name, {}).get("production_tons", 0)
                if prod > 0:
                    crop_totals.append((c, prod))
            crop_totals.sort(key=lambda x: x[1], reverse=True)
            top_str = "\n".join([f"{i+1}. {c} (~{int(p):,} tonnes)" for i, (c, p) in enumerate(crop_totals[:15])])
            context_stats += f"\nREAL STATS FOR {crop_name.upper()} PRODUCTION (USE THIS EXACT DATA IF ASKED FOR RANKINGS):\n{top_str}\n"
    except Exception as e:
        print("Chat Context Error:", e)

    # Build a rich, grounded context from the AFA database for ALL counties and crops
    afa_context_lines = []
    for c_name, c_data in afa_data_cache.items():
        for cr_name, cr_years in c_data.items():
            for yr, vals in cr_years.items():
                if yr == 'mean': continue
                afa_context_lines.append(
                    f"{c_name} | {cr_name} | {yr}: yield={vals.get('yield_tha',0):.2f} t/ha, "
                    f"area={vals.get('area_ha',0):.0f} ha, production={vals.get('prod',0):.0f} tons"
                )
    afa_block = "\n".join(afa_context_lines) if afa_context_lines else "No AFA data loaded."

    sys_prompt = f"""You are the AI Advisor for the AgriWatch KE — Kenya National Food Security Dashboard.
You ONLY answer questions about crop yields, area cultivated, production volumes, and agronomy advice for Kenya.

CURRENT USER CONTEXT:
- County: {req.context_county}
- Crop: {req.context_crop}
- Available crops in this system: Maize, Wheat, Potatoes, Pigeonpeas — ONLY these four.

STRICT RULES (NEVER BREAK THESE):
1. ONLY refer to the data below. Never invent or estimate statistics.
2. If asked about any crop NOT in [Maize, Wheat, Potatoes, Pigeonpeas], say: "I only have data for Maize, Wheat, Potatoes, and Pigeonpeas in this system."
3. If asked about a county not in the data, say you don't have data for it.
4. Never say "approximately", "around", "I think" or similar hedges when citing numbers — use exact values from the data.
5. Do NOT mention soybeans, rice, tea, coffee, or any other crop not in the list above.
6. If the user asks for a map or spatial distribution, set "map_requested" to true.

REAL AFA DATABASE (cite ONLY these numbers):
{afa_block}

QUICK REFERENCE for {req.context_county} / {req.context_crop}:
{context_stats}

OUTPUT FORMAT — you MUST respond with ONLY this JSON (no markdown fences):
{{
  "answer": "Your detailed, helpful response. Use dashes (-) for lists, not asterisks. Use <b>text</b> for bold.",
  "map_requested": false,
  "crop": "The crop being discussed — must be one of: Maize, Wheat, Potatoes, Pigeonpeas. Default: {req.context_crop}",
  "county": "The county being discussed, or 'Kenya' for national. Default: {req.context_county}",
  "year": null
}}
"""
    
    formatted_history = []
    for msg in req.history:
        # Gemini roles: 'user' and 'model'
        role = 'user' if msg.role == 'user' else 'model'
        formatted_history.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg.content)])
        )
        
    try:
        config = types.GenerateContentConfig(
            response_mime_type="application/json"
        )
        chat_session = gemini_client.chats.create(model='gemini-2.5-flash', config=config, history=formatted_history)
        
        response = chat_session.send_message(
            f"SYSTEM INSTRUCTIONS:\n{sys_prompt}\n\nUSER QUERY:\n{req.query}"
        )
        
        ai_data = json.loads(response.text)
        answer = ai_data.get("answer", "I could not process your request.")
        map_url = None
        
        # Determine if we should generate map
        if ai_data.get("map_requested") and ai_data.get("year"):
            try:
                filename = generate_county_map(ai_data.get("county"), ai_data.get("crop"), ai_data.get("year"))
                map_url = f"http://localhost:8000/images/{filename}"
                answer += "\n\n*(Map attached below)*"
            except Exception as e:
                print("Map Gen Error:", e)
                answer += "\n\n*(I encountered an error generating the map image.)*"
        elif ai_data.get("map_requested") and not ai_data.get("year"):
            answer += "\n\nWhich year would you like the map for? (e.g., 2024 or 2026 for predicted)"
            
        return {
            "answer": answer,
            "map_url": map_url
        }
    except Exception as e:
        print("Gemini Error:", e)
        # Fallback
        return {
            "answer": f"I experienced an error connecting to my AI core: {str(e)}",
            "map_url": None
        }

@app.post("/api/cron/precache")
def precache_data(background_tasks: BackgroundTasks):
    def fetch_all():
        from services.earth_engine_service import ee_service
        counties = list(stats_data.get("counties", {}).keys())
        year = datetime.now().year
        for c in counties:
            try:
                print(f"Pre-caching predictors for {c}...")
                ee_service.get_predictors(c, "", year, "Maize")
                print(f"Pre-caching phenology for {c}...")
                ee_service.get_phenology(c, "", year)
            except Exception as e:
                print(f"Error caching {c}: {e}")
                
    background_tasks.add_task(fetch_all)
    return {"message": "Pre-caching started in background"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
