import json
import re

with open(r'C:\Users\PC\Documents\KenyaYieldV2\Backend\main.py', 'r') as f:
    code = f.read()

# 1. Add historical maize parsing to load_assets
load_assets_replacement = '''
hist_maize_data = {}

@app.on_event("startup")
def load_assets():
    global xgb_model, feature_cols, stats_data, hist_maize_data
    
    if STATS_FILE.exists():
        with open(STATS_FILE, 'r') as f:
            stats_data = json.load(f)
            
    hist_file = V2_BASE_DIR / "data" / "maize_historical_2021_2025.json"
    if hist_file.exists():
        with open(hist_file, 'r') as f:
            hist_maize_data = json.load(f)
'''

code = re.sub(r'@app\.on_event\("startup"\)\ndef load_assets\(\):(.*?)def get_locations\(\):', load_assets_replacement + '\n@app.get("/api/locations")\ndef get_locations():', code, flags=re.DOTALL)

# 2. Add an intercept to _get_baseline
get_baseline_replacement = '''
def _get_baseline(county: str, subcounty: str, crop: str):
    total_area = 0
    total_prod = 0
    
    # NEW LOGIC for Maize Historical Baseline Override
    if crop == "Maize" and hist_maize_data:
        # Use 2025 as the latest baseline representation
        if county == "Kenya":
            for c, c_data in hist_maize_data.items():
                total_area += c_data["2025"]["area"]
                total_prod += c_data["2025"]["prod"]
        elif subcounty == "" and county in hist_maize_data:
            total_area = hist_maize_data[county]["2025"]["area"]
            total_prod = hist_maize_data[county]["2025"]["prod"]
        elif county in hist_maize_data:
            # We don't have subcounty breakdown in the historical table, 
            # so we estimate using ratio of SPAM data if available.
            c_data = stats_data.get("counties", {}).get(county, {})
            sub_total_area = 0
            for s, s_data in c_data.get("subcounties", {}).items():
                cd = s_data.get(crop, {})
                sub_total_area += cd.get("area_harvested_ha", 0)
                
            sub_ratio = 1.0
            if sub_total_area > 0:
                sc_data = c_data.get("subcounties", {}).get(subcounty, {}).get(crop, {})
                sc_area = sc_data.get("area_harvested_ha", 0)
                sub_ratio = sc_area / sub_total_area
                
            total_area = hist_maize_data[county]["2025"]["area"] * sub_ratio
            total_prod = hist_maize_data[county]["2025"]["prod"] * sub_ratio
            
        if total_area > 0:
            return {"area_harvested_ha": total_area, "production_tons": total_prod, "yield_tha": total_prod / total_area}

    if county == "Kenya":
'''

code = re.sub(r'def _get_baseline\(county: str, subcounty: str, crop: str\):\n    total_area = 0\n    total_prod = 0\n    if county == "Kenya":', get_baseline_replacement, code)

# 3. Add yield calibration to XGBoost predictions in /api/yield-analysis
yield_replacement = '''
    predicted_yield = float(xgb_model.predict(df)[0])
    predicted_yield = max(0, predicted_yield) # No negative yields
    
    # Scale yield prediction based on difference between SPAM and new baseline
    old_baseline_yield = 1.0
    if crop == "Maize":
        # Estimate old SPAM yield
        old_data = stats_data.get("counties", {}).get(county, {})
        if old_data:
            cd = old_data.get("county_summary", {}).get(crop, {})
            old_baseline_yield = cd.get("yield_tha", 1.0)
    
    if old_baseline_yield > 0 and base_yield > 0 and crop == "Maize":
        multiplier = base_yield / old_baseline_yield
        predicted_yield = predicted_yield * multiplier
'''

code = re.sub(r'    predicted_yield = float\(xgb_model\.predict\(df\)\[0\]\)\n    predicted_yield = max\(0, predicted_yield\) # No negative yields', yield_replacement, code)

# 4. Same for /api/analytics/trends
trends_replacement = '''
                pred_y = max(0, float(xgb_model.predict(df_in)[0])) if current_area > 0 else 0.0

                # Calibration
                old_baseline_yield = 1.0
                if crop == "Maize":
                    old_data = stats_data.get("counties", {}).get(county, {})
                    if old_data:
                        old_baseline_yield = old_data.get("county_summary", {}).get(crop, {}).get("yield_tha", 1.0)
                
                if old_baseline_yield > 0 and base_yield > 0 and crop == "Maize":
                    pred_y = pred_y * (base_yield / old_baseline_yield)
'''

code = re.sub(r'                pred_y = max\(0, float\(xgb_model\.predict\(df_in\)\[0\]\)\) if current_area > 0 else 0\.0', trends_replacement, code)


with open(r'C:\Users\PC\Documents\KenyaYieldV2\Backend\main.py', 'w') as f:
    f.write(code)

print("Patched main.py")
