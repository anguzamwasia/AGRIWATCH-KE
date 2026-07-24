import pandas as pd
import numpy as np
import json
import xgboost as xgb
from pathlib import Path
import logging
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

V2_BASE_DIR = Path(__file__).parent.parent
PROCESSED_DIR = V2_BASE_DIR / "data" / "processed"
MODEL_DIR = V2_BASE_DIR / "models" / "saved"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

STATS_FILE = V2_BASE_DIR.parent / "Frontend" / "src" / "data" / "base_crops_stats.json"
CLIMATE_FILE = PROCESSED_DIR / "historical_climate_data.csv"
AFA_FILE = V2_BASE_DIR / "data" / "afa_official_stats.csv"
MODEL_FILE = MODEL_DIR / "xgb_yield_model.json"

CROPS = ["Maize", "Pigeonpeas", "Potatoes", "Wheat"]

def train_model():
    logger.info("Loading data...")
    if not STATS_FILE.exists() or not CLIMATE_FILE.exists():
        logger.error("Required data files not found.")
        return

    with open(STATS_FILE, 'r') as f:
        stats = json.load(f)
        
    climate_df = pd.read_csv(CLIMATE_FILE)
    
    annual_climate = climate_df.groupby(['year', 'county', 'subcounty']).agg({
        'rainfall': 'sum',
        'temp': 'mean',
        'ndvi': 'mean',
        'moisture': 'mean'
    }).reset_index()
    
    climate_2017 = annual_climate[annual_climate['year'] == 2017].set_index(['county', 'subcounty'])
    
    # Load AFA Stats
    county_baselines = {}
    if AFA_FILE.exists():
        afa_df = pd.read_csv(AFA_FILE)
        for (county, crop), group in afa_df.groupby(['county', 'crop']):
            if county not in county_baselines:
                county_baselines[county] = {}
            county_baselines[county][crop] = {
                "afa_area": group['area_ha'].mean(),
                "afa_yield": group['yield_tha'].mean()
            }
            
    # Precompute TIF baselines to scale them smoothly
    tif_baselines = {}
    for county, c_data in stats.get("counties", {}).items():
        tif_baselines[county] = {}
        for crop in CROPS:
            tot_area = 0
            tot_prod = 0
            for sub, s_data in c_data.get("subcounties", {}).items():
                c_stats = s_data.get(crop, {})
                area = c_stats.get("area_harvested_ha", 0)
                yld = c_stats.get("yield_tha", 0)
                tot_area += area
                tot_prod += (area * yld)
            avg_yld = (tot_prod / tot_area) if tot_area > 0 else 0
            tif_baselines[county][crop] = {"tif_county_area": tot_area, "tif_county_yield": avg_yld}
            
    records = []
    
    # 1. Generate Synthetic Spatial Data for subcounties
    for county, c_data in stats.get("counties", {}).items():
        for subcounty, s_data in c_data.get("subcounties", {}).items():
            try:
                base_c = climate_2017.loc[(county, subcounty)]
                base_rain = base_c['rainfall']
                base_temp = base_c['temp']
                base_ndvi = base_c['ndvi']
            except KeyError:
                continue
                
            for crop in CROPS:
                crop_stats = s_data.get(crop, {})
                tif_area = crop_stats.get("area_harvested_ha", 0)
                tif_yield = crop_stats.get("yield_tha", 0)
                
                afa_stats = county_baselines.get(county, {}).get(crop, {"afa_area": tif_area, "afa_yield": tif_yield})
                afa_area = afa_stats["afa_area"]
                afa_yield = afa_stats["afa_yield"]
                
                # Scale the TIF synthetic target so the model doesn't get confused by the real AFA targets
                t_county = tif_baselines[county][crop]
                scale_yield = (afa_yield / t_county["tif_county_yield"]) if t_county["tif_county_yield"] > 0 else 1.0
                synthetic_target_baseline = tif_yield * scale_yield if afa_yield > 0 else tif_yield
                
                sub_climate = annual_climate[(annual_climate['county'] == county) & (annual_climate['subcounty'] == subcounty)]
                
                for _, row in sub_climate.iterrows():
                    y_rain = row['rainfall']
                    y_temp = row['temp']
                    y_ndvi = row['ndvi']
                    y_moist = row['moisture']
                    
                    # Randomize afa_yield slightly across synthetic years so the model is FORCED 
                    # to use the afa_yield feature instead of memorizing the county name!
                    simulated_afa_yield = afa_yield * np.random.uniform(0.5, 1.5)
                    scale_yield = (simulated_afa_yield / t_county["tif_county_yield"]) if t_county["tif_county_yield"] > 0 else 1.0
                    synthetic_target_baseline = tif_yield * scale_yield if simulated_afa_yield > 0 else tif_yield
                    
                    if synthetic_target_baseline == 0:
                        simulated_yield = 0
                    else:
                        rain_effect = (y_rain - base_rain) * 0.0005
                        temp_effect = (base_temp - y_temp) * 0.10
                        ndvi_effect = (y_ndvi - base_ndvi) * 1.0
                        total_effect = 1.0 + rain_effect + temp_effect + ndvi_effect
                        total_effect = max(0.2, min(1.8, total_effect)) + np.random.normal(0, 0.05)
                        simulated_yield = synthetic_target_baseline * total_effect
                    
                    records.append({
                        'county': county,
                        'subcounty': subcounty,
                        'crop': crop,
                        'year': row['year'],
                        'rainfall': y_rain,
                        'temp': y_temp,
                        'ndvi': y_ndvi,
                        'moisture': y_moist,
                        'base_area': tif_area,     # TIF COMPLEMENT
                        'base_yield': tif_yield,   # TIF COMPLEMENT
                        'afa_area': afa_area,      # AFA COMPLEMENT
                        'afa_yield': simulated_afa_yield,    # NOISY AFA TARGET
                        'target_yield_tha': simulated_yield,
                        'is_real_csv': False
                    })
                    
    # 2. Append AFA Official Data as Ground Truth
    if AFA_FILE.exists():
        for _, row in afa_df.iterrows():
            c_year = row['year']
            c_county = row['county']
            c_crop = row['crop']
            c_area = row['area_ha']
            c_yield = row['yield_tha']
            
            c_climate = annual_climate[(annual_climate['year'] == c_year) & (annual_climate['county'] == c_county)]
            if not c_climate.empty:
                avg_rain = c_climate['rainfall'].mean()
                avg_temp = c_climate['temp'].mean()
                avg_ndvi = c_climate['ndvi'].mean()
                avg_moist = c_climate['moisture'].mean()
                
                t_county = tif_baselines.get(c_county, {}).get(c_crop, {"tif_county_area": 0, "tif_county_yield": 0})
                
                records.append({
                    'county': c_county,
                    'subcounty': 'County Average',
                    'crop': c_crop,
                    'year': c_year,
                    'rainfall': avg_rain,
                    'temp': avg_temp,
                    'ndvi': avg_ndvi,
                    'moisture': avg_moist,
                    'base_area': t_county["tif_county_area"],  # TIF COMPLEMENT
                    'base_yield': t_county["tif_county_yield"], # TIF COMPLEMENT
                    'afa_area': c_area,                        # AFA COMPLEMENT
                    'afa_yield': c_yield,                      # AFA COMPLEMENT
                    'target_yield_tha': c_yield,
                    'is_real_csv': True
                })
                
    df = pd.DataFrame(records)
    logger.info(f"Generated {len(df)} total records.")
    
    test_mask = (df['is_real_csv'] == True) & (df['year'].isin([2024, 2025]))
    train_df = df[~test_mask]
    test_df = df[test_mask]
    
    df_encoded = pd.get_dummies(df, columns=['crop', 'county'])
    
    feature_cols = ['rainfall', 'temp', 'ndvi', 'moisture', 'base_area', 'base_yield', 'afa_area', 'afa_yield'] + [c for c in df_encoded.columns if c.startswith('crop_') or c.startswith('county_')]
    
    X_train = df_encoded[~test_mask][feature_cols]
    y_train = df_encoded[~test_mask]['target_yield_tha']
    
    logger.info("Training XGBoost Regressor...")
    model = xgb.XGBRegressor(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
    model.fit(X_train, y_train)
    
    if not test_df.empty:
        X_test = df_encoded[test_mask][feature_cols]
        y_test = df_encoded[test_mask]['target_yield_tha']
        preds = model.predict(X_test)
        mae = mean_absolute_error(y_test, preds)
        rmse = root_mean_squared_error(y_test, preds)
        logger.info(f"=== TEST EVALUATION ON AFA OFFICIAL DATA (2024-2025) ===")
        logger.info(f"Tested on {len(test_df)} real observations.")
        logger.info(f"MAE: {mae:.2f} t/ha")
        logger.info(f"RMSE: {rmse:.2f} t/ha")
        logger.info("=========================================================")
    
    model.save_model(MODEL_FILE)
    logger.info(f"Model saved to {MODEL_FILE}")
    
    with open(MODEL_DIR / "features.json", "w") as f:
        json.dump(feature_cols, f)

if __name__ == "__main__":
    train_model()

