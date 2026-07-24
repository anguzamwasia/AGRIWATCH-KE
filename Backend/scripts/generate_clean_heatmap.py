import rasterio
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path
import rasterio.mask
from shapely.geometry import box
import os

def generate_crop_heatmap(crop_name, tif_path, out_path):
    print(f"Generating clean heatmap for {crop_name}...")
    
    # Kenya bounding box from Leaflet: [[-4.7, 33.9], [5.0, 41.9]]
    min_lon, min_lat = 33.9, -4.7
    max_lon, max_lat = 41.9, 5.0
    
    bbox = box(min_lon, min_lat, max_lon, max_lat)
    
    with rasterio.open(tif_path) as src:
        try:
            out_image, out_transform = rasterio.mask.mask(src, [bbox], crop=True)
            data = out_image[0]
        except Exception as e:
            print("Masking error, using full dataset:", e)
            data = src.read(1)
            
    # Clean data
    data = np.where(data <= 0, np.nan, data)
    
    # Render with matplotlib
    fig = plt.figure(figsize=(10, 10), dpi=300)
    ax = plt.Axes(fig, [0., 0., 1., 1.])
    ax.set_axis_off()
    fig.add_axes(ax)
    
    # For maize use a green-yellow heatmap
    cmap = 'YlGn' if crop_name.lower() == 'maize' else 'YlOrRd'
    
    # Log scale for better visibility of low values
    ax.imshow(np.log1p(data), cmap=cmap, aspect='auto', alpha=0.8, interpolation='bilinear')
    
    # Save as transparent PNG
    plt.savefig(out_path, transparent=True, format='png', bbox_inches='tight', pad_inches=0)
    plt.close()
    print(f"Saved {out_path}")

raw_dir = Path(r"C:\Users\PC\Documents\kenya-yield-insight\Backend\data\raw")
images_dir = Path(r"C:\Users\PC\Documents\KenyaYieldV2\Backend\images")
images_dir.mkdir(parents=True, exist_ok=True)

crops = {
    'Maize': raw_dir / 'spam2017V2r1_SSA_H_MAIZ_A.tif',
    'Wheat': raw_dir / 'spam2017V2r1_SSA_H_WHEA_A.tif',
    'Potatoes': raw_dir / 'spam2017V2r1_SSA_H_POTA_A.tif',
    'Pigeonpeas': raw_dir / 'spam2017V2r1_SSA_H_PIGE_A.tif',
}

for crop, path in crops.items():
    if path.exists():
        generate_crop_heatmap(crop, path, images_dir / f"{crop.lower()}_distribution.png")
    else:
        print(f"File not found: {path}")
