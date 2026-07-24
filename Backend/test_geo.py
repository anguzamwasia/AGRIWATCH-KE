import geopandas as gpd
url = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/KEN/ADM1/geoBoundaries-KEN-ADM1.geojson"
try:
    gdf = gpd.read_file(url)
    print("Columns:", gdf.columns)
    print("First 5 counties:", gdf['shapeName'].head().tolist())
except Exception as e:
    print("Error:", e)
