import os
import json
import nbformat as nbf

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
notebooks_dir = os.path.join(backend_dir, 'notebooks')
os.makedirs(notebooks_dir, exist_ok=True)

nb = nbf.v4.new_notebook()

# Add markdown cell
nb['cells'].append(nbf.v4.new_markdown_cell("# Kenya Yield Insight: Model Predictions\n\nThis notebook demonstrates how the XGBoost model predicts crop yields across Kenya's counties. It uses the foundational area statistics extracted from the raw SPAM `.tif` files and the environmental variables from Google Earth Engine."))

code_cells = []

# Cell 1: Setup and imports
code_cells.append("""import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import json
import xgboost as xgb
import os

# Set up paths
backend_dir = os.path.abspath('..')
stats_file = os.path.join(backend_dir, 'data', 'base_crops_stats.json')
model_file = os.path.join(backend_dir, 'models', 'saved', 'xgb_yield_model.json')
features_file = os.path.join(backend_dir, 'models', 'saved', 'features.json')
historical_file = os.path.join(backend_dir, 'data', 'processed', 'historical_climate_data.csv')

with open(stats_file, 'r') as f:
    spam_stats = json.load(f)
""")

# Cell 2: Aggregate SPAM data by County
code_cells.append("""# Aggregate SPAM subcounty data to get County totals
county_baseline = []
for county, c_data in spam_stats.get('counties', {}).items():
    area = 0
    prod = 0
    for sub, sub_data in c_data.get('subcounties', {}).items():
        area += sub_data.get('Maize', {}).get('area_harvested_ha', 0)
        prod += sub_data.get('Maize', {}).get('production_tons', 0)
        
    if area > 0:
        county_baseline.append({
            'County': county,
            'SPAM_Area_Ha': area,
            'SPAM_Prod_MT': prod,
            'SPAM_Yield_MT_Ha': prod / area
        })

df_spam = pd.DataFrame(county_baseline).sort_values('SPAM_Prod_MT', ascending=False)
df_spam.head()
""")

# Cell 3: Run XGBoost Model using environmental conditions
code_cells.append("""# Load XGBoost Model
xgb_model = xgb.XGBRegressor()
xgb_model.load_model(model_file)

with open(features_file, 'r') as f:
    feature_cols = json.load(f)

# Load EE historical data to get climate features
hist_df = pd.read_csv(historical_file)
# Use the most recent full year (2024) to represent current climate trends
recent_climate = hist_df[hist_df['year'] == 2024]

predictions = []

for idx, row in df_spam.iterrows():
    county = row['County']
    
    # Get climate data for county (avg over subcounties)
    c_climate = recent_climate[recent_climate['county'] == county]
    if c_climate.empty: continue
        
    avg_rain = c_climate['rainfall'].sum() / len(c_climate['subcounty'].unique())
    avg_temp = c_climate['temp'].mean()
    avg_ndvi = c_climate['ndvi'].mean()
    avg_moist = c_climate['moisture'].mean()
    
    input_data = {
        'rainfall': avg_rain,
        'temp': avg_temp,
        'ndvi': avg_ndvi,
        'moisture': avg_moist,
        'area_harvested_ha': row['SPAM_Area_Ha']
    }
    
    # One-hot encode crop
    for c in feature_cols:
        if c.startswith('crop_'):
            input_data[c] = 1 if c == "crop_Maize" else 0
            
    df_in = pd.DataFrame([input_data])
    for col in feature_cols:
        if col not in df_in.columns: df_in[col] = 0
    df_in = df_in[feature_cols]
    
    pred_y = float(xgb_model.predict(df_in)[0])
    pred_prod = pred_y * row['SPAM_Area_Ha']
    
    predictions.append({
        'County': county,
        'SPAM_Area_Ha': row['SPAM_Area_Ha'],
        'SPAM_Yield_MT_Ha': row['SPAM_Yield_MT_Ha'],
        'Predicted_Yield_MT_Ha': pred_y,
        'Predicted_Prod_MT': pred_prod
    })

df_preds = pd.DataFrame(predictions).sort_values('Predicted_Prod_MT', ascending=False)
df_preds.head(10)
""")

# Cell 4: Plot Predictions
code_cells.append("""plt.figure(figsize=(14, 6))
sns.barplot(data=df_preds.head(15), x='County', y='Predicted_Prod_MT', color='green', alpha=0.7)
plt.title("Maize Predicted Production by County (Top 15) using SPAM TIFs & EE Climate Data")
plt.xticks(rotation=45)
plt.ylabel("Predicted Production (MT)")
plt.tight_layout()
plt.show()

plt.figure(figsize=(14, 6))
sns.scatterplot(data=df_preds, x='SPAM_Yield_MT_Ha', y='Predicted_Yield_MT_Ha', s=100, alpha=0.7, color='purple')
plt.plot([0, 5], [0, 5], 'r--', label='No Change from Baseline')
plt.title("Yield Shift: Baseline (.tif) vs Model Prediction (Environmental)")
plt.xlabel("Baseline Yield (MT/Ha)")
plt.ylabel("Predicted Yield (MT/Ha)")
plt.legend()
plt.tight_layout()
plt.show()
""")

for cell_content in code_cells:
    nb['cells'].append(nbf.v4.new_code_cell(cell_content))

notebook_path = os.path.join(notebooks_dir, 'Yield_Predictions.ipynb')
with open(notebook_path, 'w') as f:
    nbf.write(nb, f)

print(f"Notebook generated successfully at {notebook_path}")
