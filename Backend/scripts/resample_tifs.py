import rasterio
from rasterio.enums import Resampling
import rasterio.mask
import os
import geopandas as gpd
from pathlib import Path
import numpy as np

raw_dir = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data\raw")
out_dir = raw_dir

# Load Kenya boundaries to crop the TIFs before resampling
boundary_file = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data\boundaries\ken_admbnda_adm2_iebc_20191031.shp")
gdf = gpd.read_file(boundary_file)
# Dissolve all counties into one single geometry for Kenya
kenya_geom = [gdf.unary_union]

crops = ["PIGE", "POTA", "WHEA"]
vars = ["A", "H", "Y"]

SCALE_FACTOR = 20

for crop in crops:
    for var in vars:
        filename = f"spam2017V2r1_SSA_{var}_{crop}_A.tif"
        in_path = raw_dir / filename
        out_path = out_dir / f"spam2017V2r1_SSA_{var}_{crop}_A_0.5km.tif"
        
        if not in_path.exists():
            print(f"File {filename} not found.")
            continue
            
        print(f"Resampling {filename} to 0.5km...")
        
        with rasterio.open(in_path) as dataset:
            # First crop to Kenya to save memory
            cropped_data, cropped_transform = rasterio.mask.mask(dataset, kenya_geom, crop=True, nodata=0)
            
            # Now calculate new dimensions based on the cropped shape
            new_height = int(cropped_data.shape[1] * SCALE_FACTOR)
            new_width = int(cropped_data.shape[2] * SCALE_FACTOR)
            
            # Resample the cropped data
            # Use numpy array resizing via rasterio in-memory MemoryFile or manually
            # But rasterio.MemoryFile is easier
            
        with rasterio.MemoryFile() as memfile:
            kwargs = dataset.meta.copy()
            kwargs.update({
                'height': cropped_data.shape[1],
                'width': cropped_data.shape[2],
                'transform': cropped_transform
            })
            
            with memfile.open(**kwargs) as mem_dst:
                mem_dst.write(cropped_data)
                
                # Now resample from mem_dst
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
                
        if var in ["A", "H"]:
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
