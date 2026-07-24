import rasterio
from rasterio.enums import Resampling
import rasterio.mask
import os
import geopandas as gpd
from pathlib import Path
import numpy as np

raw_dir = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data\raw")
out_dir = raw_dir

# Load Kenya boundaries to crop the TIFs before resampling (if needed, though the 1km are likely already cropped)
boundary_file = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data\boundaries\ken_admbnda_adm2_iebc_20191031.shp")
gdf = gpd.read_file(boundary_file)
# Dissolve all counties into one single geometry for Kenya
kenya_geom = [gdf.union_all()]

maize_files = [
    ("maize_harvest_1km.tif", "maize_harvest_0.1km.tif", True), # True = Area variable
    ("maize_physical_1km.tif", "maize_physical_0.1km.tif", True),
    ("maize_yield_1km.tif", "maize_yield_0.1km.tif", False) # False = Yield (do not divide)
]

SCALE_FACTOR = 10 # 1km -> 0.1km

for in_filename, out_filename, is_area in maize_files:
    in_path = raw_dir / in_filename
    out_path = out_dir / out_filename
    
    if not in_path.exists():
        print(f"File {in_filename} not found.")
        continue
        
    print(f"Resampling {in_filename} to 0.1km...")
    
    with rasterio.open(in_path) as dataset:
        try:
            cropped_data, cropped_transform = rasterio.mask.mask(dataset, kenya_geom, crop=True, nodata=0)
        except ValueError:
            # Already matches bounds or disjoint? Just read it.
            cropped_data = dataset.read()
            cropped_transform = dataset.transform

        new_height = int(cropped_data.shape[1] * SCALE_FACTOR)
        new_width = int(cropped_data.shape[2] * SCALE_FACTOR)
        
        with rasterio.MemoryFile() as memfile:
            kwargs = dataset.meta.copy()
            kwargs.update({
                'height': cropped_data.shape[1],
                'width': cropped_data.shape[2],
                'transform': cropped_transform
            })
            
            with memfile.open(**kwargs) as mem_dst:
                mem_dst.write(cropped_data)
                
                # Resample
                data = mem_dst.read(
                    out_shape=(
                        dataset.count,
                        new_height,
                        new_width
                    ),
                    resampling=Resampling.bilinear
                )
                
                transform = mem_dst.transform * mem_dst.transform.scale(
                    (mem_dst.width / data.shape[-1]),
                    (mem_dst.height / data.shape[-2])
                )
                
        if is_area:
            # We are taking 1 pixel and making it 100 pixels. The area per pixel must be divided by 100.
            data = data / (SCALE_FACTOR * SCALE_FACTOR)
            
        out_kwargs = dataset.meta.copy()
        out_kwargs.update({
            'transform': transform,
            'width': data.shape[-1],
            'height': data.shape[-2]
        })
        
        with rasterio.open(out_path, 'w', **out_kwargs) as dst:
            dst.write(data)
            
print("Resampling complete.")
