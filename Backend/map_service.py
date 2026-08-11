import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.colors import ListedColormap, BoundaryNorm
import geopandas as gpd
import rasterio
from rasterio.plot import show
from rasterio.mask import mask
from rasterio.io import MemoryFile          # FIX 1: was missing, caused silent crash
import json
from pathlib import Path
import numpy as np
import logging
import os

logger = logging.getLogger(__name__)

MAP_SERVICE_DIR = Path(__file__).parent
SHAPEFILE_PATH = str(MAP_SERVICE_DIR / "data" / "boundaries" / "ken_admbnda_adm2_iebc_20191031.shp")


_kenya_gdf = None

def _get_kenya_gdf():
    global _kenya_gdf
    if _kenya_gdf is None:
        _kenya_gdf = gpd.read_file(SHAPEFILE_PATH)
        if 'ADM1_EN' in _kenya_gdf.columns:
            _kenya_gdf = _kenya_gdf.rename(columns={'ADM1_EN': 'shapeName'})
            _kenya_gdf = _kenya_gdf.dissolve(by='shapeName').reset_index()
    return _kenya_gdf

_kenya_raw_gdf = None
def _get_kenya_raw_gdf():
    global _kenya_raw_gdf
    if _kenya_raw_gdf is None:
        _kenya_raw_gdf = gpd.read_file(SHAPEFILE_PATH)
        if 'ADM1_EN' in _kenya_raw_gdf.columns:
            _kenya_raw_gdf = _kenya_raw_gdf.rename(columns={'ADM1_EN': 'shapeName'})
    return _kenya_raw_gdf


def _soil_map_from_gee(target_gdf, ax, display_name, year):
    """
    Fallback soil map using Earth Engine (OpenLandMap soil texture).
    Used when local 4.4 GB soil TIF files are not present (e.g. on Render).
    """
    try:
        import ee
        from services.earth_engine_service import ee_service

        geom = ee_service._to_ee_geom(target_gdf.geometry.unary_union.simplify(0.01))
        if geom is None:
            raise ValueError("Could not convert geometry")

        # OpenLandMap USDA soil texture class (250m resolution)
        soil_img = ee.Image('OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02').select('b0')

        # Sample at 1km for speed
        stats = soil_img.reduceRegion(
            reducer=ee.Reducer.frequencyHistogram(),
            geometry=geom,
            scale=1000,
            maxPixels=1e8
        ).getInfo()

        hist = stats.get('b0', {})
        if not hist:
            raise ValueError("No soil data returned")

        # Build synthetic soil texture choropleth per sub-area
        # Since we can't render a true raster without downloading, draw a
        # county-level fill with the dominant soil class color
        texture_colors = {
            1:  ('#5e3c99', 'Clay'),
            2:  ('#b2abd2', 'Silty Clay'),
            3:  ('#e66101', 'Sandy Clay'),
            4:  ('#fdb863', 'Clay Loam'),
            5:  ('#1a9850', 'Silty Clay Loam'),
            6:  ('#a6d96a', 'Sandy Clay Loam'),
            7:  ('#d73027', 'Loam'),
            8:  ('#f46d43', 'Silt Loam'),
            9:  ('#fdae61', 'Sandy Loam'),
            10: ('#fee08b', 'Silt'),
            11: ('#8073ac', 'Loamy Sand'),
            12: ('#dfc27d', 'Sand'),
        }

        # Dominant class
        dominant_class = max(hist, key=hist.get, default='7')
        dominant_int = int(dominant_class)
        color, label = texture_colors.get(dominant_int, ('#94a3b8', 'Unknown'))

        target_gdf.plot(ax=ax, color=color, edgecolor='#0f172a', linewidth=2, alpha=0.85)

        from matplotlib.patches import Patch
        legend_elements = [Patch(facecolor=c, label=l) for _, (c, l) in texture_colors.items()]
        ax.legend(handles=legend_elements, loc='lower right', frameon=True,
                  fancybox=True, framealpha=0.9, fontsize=7, ncol=2)

        ax.text(0.5, 0.02,
                f"Dominant soil: {label} (class {dominant_int}) — via GEE OpenLandMap",
                transform=ax.transAxes, ha='center', fontsize=9,
                color='#334155', style='italic')
        return True

    except Exception as e:
        logger.warning(f"GEE soil fallback failed: {e}")
        return False

_afa_data = None

def _does_county_grow_crop(county: str, crop: str) -> bool:
    """
    Determines if a county actually cultivates a crop above a 10 ha threshold.
    - If the crop has official AFA stats, checks if county is in AFA dataset with >= 10 ha average.
    - Otherwise, checks baseline statistics in base_crops_stats.json.
    """
    global _afa_data
    c_name = county.strip()
    cr_name = crop.strip().capitalize()
    
    # 1. Check AFA CSV first
    afa_file = Path(__file__).parent / "data" / "afa_official_stats.csv"
    if afa_file.exists():
        try:
            import pandas as pd
            if _afa_data is None:
                _afa_data = pd.read_csv(afa_file)
            
            crop_rows = _afa_data[_afa_data['crop'].str.lower() == cr_name.lower()]
            if not crop_rows.empty:
                county_rows = crop_rows[crop_rows['county'].str.lower() == c_name.lower()]
                if not county_rows.empty:
                    return county_rows['area_ha'].mean() >= 10.0
                # If the crop is in AFA but this county isn't, fall through to baseline check
        except Exception:
            pass

    # 2. Check base_crops_stats.json fallback
    stats_file = Path(__file__).parent.parent / "Frontend" / "src" / "data" / "base_crops_stats.json"
    if stats_file.exists():
        try:
            with open(stats_file, 'r', encoding='utf-8') as f:
                stats = json.load(f)
            c_data = stats.get("counties", {}).get(county, {})
            tot_area = 0
            for s, s_data in c_data.get("subcounties", {}).items():
                tot_area += s_data.get(cr_name, {}).get("area_harvested_ha", 0)
            return tot_area >= 10.0
        except Exception:
            pass

    return True

def generate_county_tif(county: str, crop: str, year: int, subcounty: str = "", predicted_yield: float = None, base_yield: float = None) -> str:
    """
    Generates a clipped, 0.1km-resolution yield TIF for georaster client rendering.
    Uses SPAM yield (kg/ha) masked by harvested-area presence AND official county stats.
    Counties or subcounties that do not officially grow the crop will show as completely blank.
    """
    # Normalize subcounty parameter
    if subcounty:
        s_clean = subcounty.strip().lower()
        if s_clean in ["", "select subcounty", "entire county", "entire-county", "select_subcounty", "select_sub_county"]:
            subcounty = ""

    from rasterio.enums import Resampling
    from rasterio.warp import reproject
    from rasterio.features import rasterize

    data_dir = Path(__file__).parent / "data"

    # Dynamic resolution: use raw if available (dev machine), otherwise processed fallback (Render)
    CROP_PREFIXES = {
        "maize": "MAIZ",
        "wheat": "WHEA",
        "potatoes": "POTA",
        "pigeonpeas": "PIGE",
    }
    prefix = CROP_PREFIXES.get(crop.lower(), "MAIZ")

    raw_y = data_dir / "raw" / ("maize_yield_0.1km.tif" if crop.lower() == "maize" else f"spam2017V2r1_SSA_Y_{prefix}_A.tif")
    raw_h = data_dir / "raw" / ("maize_harvest_0.1km.tif" if crop.lower() == "maize" else f"spam2017V2r1_SSA_H_{prefix}_A.tif")

    if raw_y.exists() and raw_h.exists():
        y_path, h_path = raw_y, raw_h
    else:
        y_path = data_dir / "processed" / f"kenya_Y_{prefix}.tif"
        h_path = data_dir / "processed" / f"kenya_H_{prefix}.tif"

    if not y_path.exists():
        logger.error(f"Yield TIF missing: {y_path}")
        return ""

    # Load official crops stats to check if crop is officially grown in this region
    stats_file = Path(__file__).parent.parent / "Frontend" / "src" / "data" / "base_crops_stats.json"
    stats_data = {}
    if stats_file.exists():
        try:
            with open(stats_file, "r", encoding="utf-8") as f:
                stats_data = json.load(f)
        except Exception as e:
            logger.error(f"Error loading stats file: {e}")

    # Standardize crop name to match stats keys
    title_crop = crop.capitalize()

    # Resolve target geography
    gdf = _get_kenya_raw_gdf()
    is_national = county.lower() in ["kenya", "country", ""]

    # Identify if the selected county/subcounty has zero area officially
    has_zero_area = False
    zero_counties = []

    if stats_data:
        if is_national:
            for c_name in stats_data.get("counties", {}).keys():
                if not _does_county_grow_crop(c_name, title_crop):
                    zero_counties.append(c_name)
        elif subcounty and subcounty not in ["", "Select subcounty"]:
            crop_sum = stats_data.get("counties", {}).get(county, {}).get("subcounties", {}).get(subcounty, {}).get(title_crop, {})
            if crop_sum.get("area_harvested_ha", 0) < 1.0:
                has_zero_area = True
        else:
            if not _does_county_grow_crop(county, title_crop):
                has_zero_area = True

    if is_national:
        target_gdf = gdf.dissolve()
    elif subcounty and subcounty not in ["", "Select subcounty"]:
        target_gdf = gdf[
            (gdf["shapeName"].str.lower() == county.lower()) &
            (gdf["ADM2_EN"].str.lower() == subcounty.lower())
        ]
        if target_gdf.empty:
            target_gdf = gdf[gdf["shapeName"].str.lower() == county.lower()]
    else:
        target_gdf = gdf[gdf["shapeName"].str.lower() == county.lower()]
        if target_gdf.empty:
            target_gdf = gdf

    # Output path
    out_dir = Path(__file__).parent / "images"
    out_dir.mkdir(exist_ok=True)
    safe_county = county.lower().replace(" ", "_")
    safe_sub = subcounty.lower().replace(" ", "_") if subcounty else ""
    filename = f"{safe_county}_{safe_sub}_{crop.lower()}_{year}_yield.tif"
    out_path = out_dir / filename

    # Use cached TIF if it already exists to achieve instant rendering
    if out_path.exists():
        return filename

    try:
        with rasterio.open(y_path) as y_src:
            y_nodata = y_src.nodata if y_src.nodata is not None else -1
            shapes_crs = target_gdf.to_crs(y_src.crs)
            shapes = [geom for geom in shapes_crs.geometry]

            # Clip yield to county/subcounty
            y_clipped, y_transform = mask(y_src, shapes, crop=True, nodata=y_nodata)
            y_data = y_clipped[0].astype(np.float32)

            is_synthetic = False
            if y_data.max() <= 0.0 and not has_zero_area:
                # Synthetic fill for counties that grow the crop but lack SPAM pixels
                is_synthetic = True
                fill_val = (base_yield * 1000.0) if (base_yield and base_yield > 0.0) else 1500.0
                county_mask = rasterize(
                    [(geom, 1) for geom in shapes_crs.geometry],
                    out_shape=y_data.shape,
                    transform=y_transform,
                    fill=0,
                    dtype=np.uint8
                )
                y_data[county_mask == 1] = fill_val

            # Apply harvested-area mask: only keep pixels where crop is actually grown
            if h_path.exists() and not is_synthetic:
                with rasterio.open(h_path) as h_src:
                    h_nodata = h_src.nodata if h_src.nodata is not None else -1
                    h_clipped, _ = mask(h_src, shapes, crop=True, nodata=h_nodata)
                    h_data = h_clipped[0].astype(np.float32)
                    no_crop = (h_data <= 0.0001) | (h_data == h_nodata)
                    y_data[no_crop] = 0.0

            # ── Apply Dynamic Yield Scaling (XGBoost Ratio) ──
            if predicted_yield is not None and base_yield is not None and base_yield > 0.0:
                scale_factor = predicted_yield / base_yield
                # Limit scale factor to a reasonable range [0.1, 5.0] to prevent extreme artifacts
                scale_factor = max(0.1, min(5.0, scale_factor))
                y_data = y_data * scale_factor

            # ── Apply Official Stats Mask ──
            if has_zero_area:
                # Officially not grown here, zero out the whole map
                y_data.fill(0.0)
            elif is_national and zero_counties:
                # Zero out any county that does not grow this crop
                zero_gdf = gdf[gdf["shapeName"].str.lower().isin([c.lower() for c in zero_counties])]
                if not zero_gdf.empty:
                    zero_mask = rasterize(
                        [(geom, 1) for geom in zero_gdf.to_crs(y_src.crs).geometry],
                        out_shape=y_data.shape,
                        transform=y_transform,
                        fill=0,
                        dtype=np.uint8
                    )
                    y_data[zero_mask == 1] = 0.0

            # Clean up remaining nodata / negatives
            y_data[y_data < 0] = 0.0
            y_data[y_data == y_nodata] = 0.0

            out_band = y_data[np.newaxis, ...]  # restore band dimension

            # Resample to ~0.1 km (~0.000833 deg) if source is coarser
            TARGET_RES = 0.000833333
            current_res = y_src.res[0]
            if current_res > TARGET_RES * 1.5:
                h, w = out_band.shape[1], out_band.shape[2]
                scale = current_res / TARGET_RES
                new_h = max(1, int(round(h * scale)))
                new_w = max(1, int(round(w * scale)))
                new_transform = rasterio.transform.from_bounds(
                    *rasterio.transform.array_bounds(h, w, y_transform),
                    new_w, new_h
                )
                resampled = np.zeros((1, new_h, new_w), dtype=np.float32)
                reproject(
                    source=out_band, destination=resampled,
                    src_transform=y_transform, src_crs=y_src.crs,
                    dst_transform=new_transform, dst_crs=y_src.crs,
                    resampling=Resampling.bilinear,
                )
                out_band = resampled
                y_transform = new_transform

            # Clean up remaining nodata / negatives and low-yield noise (post-resampling)
            min_yield = 200.0 if crop.lower() == "potatoes" else 50.0
            out_band[out_band < min_yield] = 0.0
            out_band[out_band == y_nodata] = 0.0

            # Re-clip to exact boundary polygon to prevent bilinear bleeding/out-of-boundary artifacts
            boundary_mask = rasterize(
                [(geom, 1) for geom in shapes_crs.geometry],
                out_shape=(out_band.shape[1], out_band.shape[2]),
                transform=y_transform,
                fill=0,
                dtype=np.uint8
            )
            out_band[0] = out_band[0] * boundary_mask


            out_meta = y_src.meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "dtype": "float32",
                "count": 1,
                "height": out_band.shape[1],
                "width": out_band.shape[2],
                "transform": y_transform,
                "nodata": 0.0,
                "compress": "lzw",
            })
            with rasterio.open(out_path, "w", **out_meta) as dest:
                dest.write(out_band)

        return filename

    except Exception as e:
        logger.error(f"Error generating TIF for {crop}/{county}: {e}")
        return ""
def generate_county_map(county: str, crop: str, year: int, map_type: str = 'crop', subcounty: str = "") -> str:
    """
    Generates a map clipped to county or subcounty boundaries.
    map_type: 'crop' | 'soil' | 'lulc'
    """
    gdf = _get_kenya_gdf()

    is_national = county.lower() in ["kenya", "country"]

    if is_national:
        target_gdf = gdf.dissolve()
        display_name = "Kenya"
    else:
        if subcounty and subcounty not in ["", "Select subcounty"]:
            target_gdf = gdf[(gdf['shapeName'].str.lower() == county.lower()) & (gdf['ADM2_EN'].str.lower() == subcounty.lower())]
            if target_gdf.empty:
                target_gdf = gdf[gdf['shapeName'].str.lower() == county.lower()]
                display_name = county
            else:
                display_name = subcounty
        else:
            target_gdf = gdf[gdf['shapeName'].str.lower() == county.lower()]
            if target_gdf.empty:
                target_gdf = gdf
                display_name = "Kenya"
                is_national = True
            else:
                display_name = target_gdf.iloc[0]['shapeName']

    # FIX 2: target_gdf_3857 was used in soil branch but never defined
    target_gdf_3857 = target_gdf.to_crs(epsg=3857)

    fig, ax = plt.subplots(figsize=(12, 10))
    ax.axis('off')
    ax.set_facecolor('none')
    fig.patch.set_alpha(0.0)

    out_dir = Path(__file__).parent / "images"
    out_dir.mkdir(exist_ok=True)

    safe_county = county.lower().replace(" ", "_")
    safe_sub = subcounty.lower().replace(" ", "_") if subcounty else ""
    filename = f"{safe_county}_{safe_sub}_{crop.lower()}_{year}_{map_type}.png"
    out_path = out_dir / filename
    if out_path.exists():
        return filename


    try:
        # ── CROP MAP ──────────────────────────────────────────────────────────
        if map_type == 'crop':
            old_project = Path(__file__).parent / "data"


            if crop.lower() == 'maize':
                raw_path = old_project / "raw" / "maize_harvest_0.1km.tif"
                if raw_path.exists():
                    tif_path = raw_path
                else:
                    tif_path = old_project / "processed" / "kenya_H_MAIZ.tif"
            else:
                crop_prefix = {'wheat': 'WHEA', 'potatoes': 'POTA', 'pigeonpeas': 'PIGE'}.get(crop.lower(), 'MAIZ')
                tif_path = old_project / "processed" / f"kenya_H_{crop_prefix}.tif"

            if tif_path.exists():
                with rasterio.open(tif_path) as src:
                    shapes = [geom for geom in target_gdf.geometry]
                    out_image, out_transform = mask(src, shapes, crop=True)
                    out_image = out_image[0]
                    out_image = np.ma.masked_where((out_image <= 0), out_image)

                    # Create custom Red -> Orange -> Green colormap to match UI legend
                    from matplotlib.colors import LinearSegmentedColormap
                    colors = ['#ef4444', '#f59e0b', '#10b981'] # Low (Red) -> Average (Orange) -> High (Green)
                    cmap = LinearSegmentedColormap.from_list('YieldCmap', colors)
                    cmap.set_bad(color='white', alpha=0)

                    show(out_image, transform=out_transform, ax=ax, cmap=cmap)
                    # No border or colorbar for clean overlay
                    # target_gdf.plot(ax=ax, facecolor="none", edgecolor='#0f172a', linewidth=2)
            else:
                target_gdf.plot(ax=ax, color='#e2e8f0', edgecolor='#0f172a', linewidth=2)
                ax.text(0.5, 0.5, "Crop Raster Data Unavailable",
                        transform=ax.transAxes, ha='center', fontsize=16)

        # ── SOIL MAP ──────────────────────────────────────────────────────────
        elif map_type == 'soil':
            import glob
            from rasterio.merge import merge

            tif_pattern = str(Path(__file__).parent / "data" / "raw" / "kenya_soil_properties-*.tif")

            tif_paths = glob.glob(tif_pattern)

            rendered = False

            if tif_paths:
                # Local TIF path (only works on developer machine)
                src_files_to_mosaic = []
                try:
                    for tif in tif_paths:
                        try:
                            src_files_to_mosaic.append(rasterio.open(tif))
                        except Exception:
                            pass

                    if src_files_to_mosaic:
                        # Convert geometries to GeoJSON dicts for rasterio.mask
                        from shapely.geometry import mapping
                        shapes = [mapping(geom) for geom in target_gdf_3857.geometry]
                        bounds_arr = list(map(float, target_gdf_3857.total_bounds))
                        merge_res = (1000.0, 1000.0) if is_national else None
                        mosaic, mos_transform = merge(
                            src_files_to_mosaic,
                            bounds=bounds_arr,
                            res=merge_res
                        )

                        profile = src_files_to_mosaic[0].profile
                        profile.update({
                            "height": int(mosaic.shape[1]),
                            "width":  int(mosaic.shape[2]),
                            "transform": mos_transform,
                            "count": int(mosaic.shape[0])
                        })

                        with MemoryFile() as memfile:
                            with memfile.open(**profile) as dataset:
                                dataset.write(mosaic)
                                out, trans = mask(dataset, shapes, crop=True)
                                if out.shape[1] > 0 and out.shape[2] > 0:
                                    data = out[7]   # band 8 = texture class (0-indexed)
                                    data = np.ma.masked_where((data <= 0) | (data > 12), data)
                                    all_masked = bool(np.all(data.mask)) if hasattr(data, 'mask') else False
                                    if not all_masked:
                                        soil_colors = [
                                            '#5e3c99', '#b2abd2', '#e66101', '#fdb863',
                                            '#1a9850', '#a6d96a', '#d73027', '#f46d43',
                                            '#fdae61', '#fee08b', '#8073ac', '#dfc27d'
                                        ]
                                        cmap = ListedColormap(soil_colors)
                                        cmap.set_bad(color='white', alpha=0)
                                        bnds = np.arange(1, 14)
                                        norm = BoundaryNorm(bnds, cmap.N)

                                        show(data, transform=trans, ax=ax,
                                             cmap=cmap, norm=norm, interpolation='nearest')
                                        target_gdf_3857.plot(ax=ax, facecolor="none",
                                                             edgecolor='#0f172a', linewidth=2)

                                        if len(ax.images) > 0:
                                            cb = fig.colorbar(ax.images[0], ax=ax,
                                                              fraction=0.046, pad=0.04,
                                                              ticks=np.arange(1.5, 13.5))
                                            cb.ax.set_yticklabels([
                                                'Clay', 'Silty Clay', 'Sandy Clay', 'Clay Loam',
                                                'Silty Clay Loam', 'Sandy Clay Loam', 'Loam',
                                                'Silt Loam', 'Sandy Loam', 'Silt', 'Loamy Sand', 'Sand'
                                            ])
                                            cb.ax.tick_params(labelsize=9)
                                            cb.set_label('Soil Texture Class', fontsize=12, fontweight='bold')
                                        rendered = True  # rendered in EPSG:3857
                except Exception as e:
                    logger.warning(f"Local soil TIF render failed: {e}")
                finally:
                    for s in src_files_to_mosaic:
                        try: s.close()
                        except: pass

            if not rendered:
                # GEE fallback — works on Render / any server without local TIF files
                rendered = _soil_map_from_gee(target_gdf, ax, display_name, year)

            if not rendered:
                target_gdf.plot(ax=ax, color='#e2e8f0', edgecolor='#0f172a', linewidth=2)
                ax.text(0.5, 0.5, "Soil Data Unavailable",
                        transform=ax.transAxes, ha='center', fontsize=16)

        # ── LULC MAP ──────────────────────────────────────────────────────────
        elif map_type == 'lulc':
            from PIL import Image

            lulc_dir = Path(__file__).parent / "data" / "processed" / "lulc"

            query_year = min(year, 2024)

            file_name = "Kenya.png" if is_national else f"{display_name.replace(' ', '_')}.png"
            png_path = lulc_dir / str(query_year) / file_name
            if not png_path.exists():
                png_path = lulc_dir / "2024" / file_name

            if png_path.exists():
                img = Image.open(png_path)
                geom_coords = [list(c) for c in target_gdf.unary_union.convex_hull.exterior.coords]
                from shapely.geometry import Polygon
                hull_poly = Polygon(geom_coords)
                bds = hull_poly.bounds
                ax.imshow(img, extent=[bds[0], bds[2], bds[1], bds[3]])
                target_gdf.plot(ax=ax, facecolor="none", edgecolor='#0f172a', linewidth=2)

                from matplotlib.patches import Patch
                legend_elements = [
                    Patch(facecolor='#E49635', label='Cultivated Crops'),
                    Patch(facecolor='#C4281B', label='Built-up Area'),
                    Patch(facecolor='#397D49', label='Trees/Forest'),
                    Patch(facecolor='#88B053', label='Grassland'),
                    Patch(facecolor='#DFC35A', label='Shrub & Scrub'),
                    Patch(facecolor='#419BDF', label='Water'),
                ]
                ax.legend(handles=legend_elements, loc='lower right', frameon=True,
                          fancybox=True, framealpha=0.9, fontsize=9)
            else:
                target_gdf.plot(ax=ax, color='#e2e8f0', edgecolor='#0f172a', linewidth=2)
                ax.text(0.5, 0.5, "LU/LC Data Unavailable",
                        transform=ax.transAxes, ha='center', fontsize=16)

        # ── COMMON: bounds, scale bar, north arrow, title ────────────────────
        # Use 3857 bounds only when the local TIF actually rendered (rendered=True AND tif_paths existed)
        local_tif_rendered = (map_type == 'soil') and rendered and bool(tif_paths)
        bounds_gdf = target_gdf_3857 if local_tif_rendered else target_gdf
        minx, miny, maxx, maxy = bounds_gdf.total_bounds

        padding = 0.05 * max((maxx - minx), (maxy - miny))
        ax.set_xlim(minx - padding, maxx + padding)
        ax.set_ylim(miny - padding, maxy + padding)

        ax.plot([minx, minx + (maxx - minx) * 0.2], [miny, miny],
                color='black', linewidth=3)
        ax.text(minx + (maxx - minx) * 0.1, miny - (maxy - miny) * 0.02,
                "Scale", ha='center', fontsize=10, fontweight='bold')

        ax.annotate('N', xy=(0.95, 0.95), xytext=(0.95, 0.85),
                    arrowprops=dict(facecolor='black', width=5, headwidth=15),
                    ha='center', va='center', fontsize=20, fontweight='bold',
                    xycoords='axes fraction')

        title_prefix = {
            'soil': 'Soil Texture',
            'lulc': 'Land Use & Land Cover',
        }.get(map_type, f"{crop.capitalize()} Spatial Distribution")

        ax.set_title(f"{title_prefix} — {display_name} ({year})",
                     fontsize=18, fontweight='bold', pad=20)
        ax.axis('off')

        # filename and out_path are already defined at the beginning of the function

        plt.subplots_adjust(top=1, bottom=0, right=1, left=0, hspace=0, wspace=0)
        plt.margins(0,0)
        ax.xaxis.set_major_locator(plt.NullLocator())
        ax.yaxis.set_major_locator(plt.NullLocator())
        plt.savefig(out_path, dpi=150, bbox_inches='tight', pad_inches=0, transparent=True)
        plt.close(fig)

        return filename

    except Exception as e:
        logger.error(f"Map generation error [{map_type}]: {e}")
        plt.close()
        return ""
