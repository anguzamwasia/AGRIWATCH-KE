import json
import requests
import time
from pathlib import Path

# Load counties
stats_file = Path("Frontend/src/data/base_crops_stats.json")
with open(stats_file, 'r') as f:
    stats = json.load(f)

counties = list(stats.get("counties", {}).keys())

print(f"Fetching geometry for {len(counties)} counties...")

county_geometry = {}
# Add default Kenya
county_geometry['Kenya'] = {
    'coords': [-1.286389, 36.817223], # Nairobi center roughly, or map center
    'bounds': [[-4.7, 33.9], [5.0, 41.9]] # Clear boundaries for Kenya
}

headers = {'User-Agent': 'GeoAI-Dashboard/1.0'}

for county in counties:
    query = f"{county} County, Kenya"
    url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1"
    
    try:
        resp = requests.get(url, headers=headers)
        data = resp.json()
        if data:
            lat = float(data[0]['lat'])
            lon = float(data[0]['lon'])
            bbox = data[0]['boundingbox'] # [minLat, maxLat, minLon, maxLon]
            # Convert to leaflet bounds: [[minLat, minLon], [maxLat, maxLon]]
            bounds = [[float(bbox[0]), float(bbox[2])], [float(bbox[1]), float(bbox[3])]]
            
            county_geometry[county] = {
                'coords': [lat, lon],
                'bounds': bounds
            }
            print(f"Found {county}: {lat}, {lon}")
        else:
            print(f"NOT FOUND: {county}")
            # Fallback
            county_geometry[county] = {'coords': [-0.0236, 37.9062], 'bounds': [[-4.7, 33.9], [5.0, 41.9]]}
    except Exception as e:
        print(f"Error {county}: {e}")
        county_geometry[county] = {'coords': [-0.0236, 37.9062], 'bounds': [[-4.7, 33.9], [5.0, 41.9]]}
        
    time.sleep(1) # Be nice to Nominatim

# Write to a JS format file
out_file = Path("Frontend/src/data/county_geometry.json")
with open(out_file, 'w') as f:
    json.dump(county_geometry, f, indent=2)

print("Saved geometry to", out_file)
