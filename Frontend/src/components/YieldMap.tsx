import { MapContainer, TileLayer, ImageOverlay, useMap, GeoJSON, ZoomControl } from "react-leaflet";

import { API_BASE_URL } from "../config";
import "leaflet/dist/leaflet.css";
import { useEffect, useState, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { LatLngBoundsExpression } from "leaflet";
import { Activity, Layers, Info } from "lucide-react";
import axios from "axios";
import { MapExportModal } from "./MapExportModal";
// @ts-ignore
import parseGeoraster from "georaster";
// @ts-ignore
import GeoRasterLayer from "georaster-layer-for-leaflet";

interface YieldMapProps {
  crop: string;
  county: string;
  subcounty: string;
  year: number;
  layer: "osm" | "satellite" | "pixel" | "lulc";
  lulcMapPath?: string;
  predictedYield?: number;
  baseYield?: number;
}

import countyGeometryData from "@/data/county_geometry.json";
const COUNTY_GEOMETRY: Record<string, { coords: [number, number]; bounds: LatLngBoundsExpression }> = countyGeometryData as any;

// Crop-specific absolute thresholds in kg/ha (derived from Kenya SPAM statistics)
const CROP_THRESHOLDS: Record<string, { lo: number; hi: number }> = {
  Maize:      { lo: 1131, hi: 1760 },  // Kenya p33/p67 from maize_yield_0.1km
  Wheat:      { lo: 1109, hi: 2189 },
  Potatoes:   { lo: 5158, hi: 14869 },
  Pigeonpeas: { lo:  629, hi:  1160 },
};

// Crop-specific color palettes for distinct visual identification
const CROP_PALETTES: Record<string, { low: string; mid: string; high: string; glow: string }> = {
  Maize: {
    low: "#ef4444",   // Red
    mid: "#f59e0b",   // Amber/Orange
    high: "#10b981",  // Emerald Green
    glow: "rgba(16,185,129,0.5)",
  },
  Wheat: {
    low: "#f87171",   // Light Red
    mid: "#fbbf24",   // Bright Gold/Yellow
    high: "#d97706",  // Ripe Golden Wheat (Brown-Amber)
    glow: "rgba(217,119,6,0.5)",
  },
  Potatoes: {
    low: "#fca5a5",   // Soft Red
    mid: "#f97316",   // Vibrant Orange
    high: "#9a3412",  // Earthy Copper/Deep Rust (Root/Potato Soil)
    glow: "rgba(154,52,18,0.5)",
  },
  Pigeonpeas: {
    low: "#f472b6",   // Soft Pink
    mid: "#c084fc",   // Purple/Lavender
    high: "#6b21a8",  // Royal Purple/Violet (Pigeonpea blossom)
    glow: "rgba(107,33,168,0.5)",
  },
};

// Crop-specific baseline yields in t/ha for relative scaling
const CROP_BASE_YIELDS: Record<string, number> = {
  Maize:      1.50,
  Wheat:      2.70,
  Potatoes:   9.80,
  Pigeonpeas: 0.85,
};

// --- MapController ------------------------------------------------------------
const MapController = ({
  county, subcounty, setExactBounds, setBoundaryGeojson,
}: {
  county: string; subcounty: string;
  setExactBounds: (b: any) => void;
  setBoundaryGeojson: (gj: any) => void;
}) => {
  const map = useMap();
  useEffect(() => {
    let live = true;
    const go = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/bounds`, { params: { county, subcounty } });
        if (!live) return;
        if (res.data?.bounds) {
          setExactBounds(res.data.bounds);
          if (res.data.geojson) setBoundaryGeojson(res.data.geojson);
          map.fitBounds(res.data.bounds, { padding: [20, 20], animate: true, duration: 1.2 });
          return;
        }
      } catch (_) {}
      if (!live) return;
      const geo = COUNTY_GEOMETRY[county] || COUNTY_GEOMETRY["Kenya"];
      if (geo?.bounds) {
        setExactBounds(geo.bounds);
        map.fitBounds(geo.bounds as any, { padding: [20, 20], animate: true, duration: 1.2 });
      } else {
        map.flyTo([-0.0236, 37.9062], 6, { animate: true, duration: 1.2 });
      }
    };
    go();
    return () => { live = false; };
  }, [county, subcounty, map, setExactBounds, setBoundaryGeojson]);
  return null;
};

// --- GeoTiffLayerComponent ----------------------------------------------------
const GeoTiffLayerComponent = ({ url, opacity, crop, scale, onStatsLoaded }: { url: string; opacity: number; crop: string; scale: number; onStatsLoaded: (stats: { min: number; max: number }) => void }) => {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      // 1. Forcefully sweep ALL georaster layers from the map immediately (robust cleanup)
      map.eachLayer((l: any) => {
        if (
          l.isGeoAIYieldLayer || 
          l.options?.isGeoAIYieldLayer ||
          l.options?.georaster || 
          l._georaster || 
          l.constructor?.name?.includes("GeoRaster")
        ) {
          try {
            map.removeLayer(l);
          } catch (e) {
            console.error("Error removing layer in initial sweep:", e);
          }
        }
      });
      layerRef.current = null;

      // 2. Fetch and render the new TIF (with cache: "no-store")
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          console.warn("TIF fetch failed:", res.status, url);
          return;
        }
        const buf = await res.arrayBuffer();
        const georaster = await parseGeoraster(buf);
        
        if (!active) return;

        // Forcefully sweep again just before adding to prevent double-layers from fast toggles
        map.eachLayer((l: any) => {
          if (
            l.isGeoAIYieldLayer || 
            l.options?.isGeoAIYieldLayer ||
            l.options?.georaster || 
            l._georaster || 
            l.constructor?.name?.includes("GeoRaster")
          ) {
            try {
              map.removeLayer(l);
            } catch (e) {
              console.error("Error removing layer in secondary sweep:", e);
            }
          }
        });

        const noData = georaster.noDataValue ?? 0;
        // Calculate dynamic relative thresholds based on the actual min/max of the raster
        const minVal = georaster.mins?.[0] ?? 0;
        const maxVal = georaster.maxs?.[0] ?? 0;
        
        onStatsLoaded({ min: minVal, max: maxVal });
        
        const cropThresholds = CROP_THRESHOLDS[crop] ?? { lo: 1000, hi: 2000 };
        const lo = cropThresholds.lo * scale;
        const hi = cropThresholds.hi * scale;

        const palette = CROP_PALETTES[crop] ?? CROP_PALETTES.Maize;

        const gl = new GeoRasterLayer({
          georaster,
          opacity,
          pixelValuesToColorFn: (values: number[]) => {
            const v = values[0];
            if (!v || v < 10.0 || v === noData || !isFinite(v)) return null;
            if (v < lo) return palette.low;
            if (v < hi) return palette.mid;
            return palette.high;
          },
          resolution: 64,
        });

        // Set custom properties to ensure safe, minification-proof removal
        gl.isGeoAIYieldLayer = true;
        gl.options.isGeoAIYieldLayer = true;

        if (!active) return;
        gl.addTo(map);
        layerRef.current = gl;
      } catch (e) {
        console.error("Georaster error:", e);
      }
    };

    load();

    return () => {
      active = false;
      if (layerRef.current) {
        try {
          map.removeLayer(layerRef.current);
        } catch (e) {
          console.error("Error removing layer in cleanup:", e);
        }
        layerRef.current = null;
      }
      // Forcefully sweep all georaster layers from the map during cleanup
      map.eachLayer((l: any) => {
        if (
          l.isGeoAIYieldLayer || 
          l.options?.isGeoAIYieldLayer ||
          l.options?.georaster || 
          l._georaster || 
          l.constructor?.name?.includes("GeoRaster")
        ) {
          try {
            map.removeLayer(l);
          } catch (e) {
            console.error("Error removing layer in cleanup sweep:", e);
          }
        }
      });
    };
  }, [url, crop, scale, map]); // re-runs on url/crop/scale change

  useEffect(() => {
    if (layerRef.current?.setOpacity) {
      layerRef.current.setOpacity(opacity);
    }
  }, [opacity]);

  return null;
};

// Tracker to pass leaflet map instance to exporter
const MapInstanceTracker = ({ onMap }: { onMap: (map: any) => void }) => {
  const map = useMap();
  useEffect(() => {
    if (map) onMap(map);
  }, [map, onMap]);
  return null;
};

// --- YieldMap -----------------------------------------------------------------
export const YieldMap = ({ crop, county, subcounty, year, layer, lulcMapPath, predictedYield, baseYield }: YieldMapProps) => {
  const [opacity, setOpacity] = useState(0.85);
  const [rasterStats, setRasterStats] = useState<{ min: number; max: number } | null>(null);
  const [exactBounds, setExactBounds] = useState<any>(null);
  const [boundaryGeojson, setBoundaryGeojson] = useState<any>(null);
  const [lulcTileUrl, setLulcTileUrl] = useState<string | null>(null);
  const [isLulcLoading, setIsLulcLoading] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);

  // Reset boundary state whenever selection changes
  useEffect(() => {
    setExactBounds(null);
    setBoundaryGeojson(null);
    setRasterStats(null);
  }, [county, subcounty, crop, year]);

  // Fetch live Earth Engine Dynamic World tile URL when layer is 'lulc'
  useEffect(() => {
    if (layer !== "lulc") return;
    let live = true;
    const fetchLulcTile = async () => {
      setIsLulcLoading(true);
      try {
        const res = await axios.post(`${API_BASE_URL}/api/ee-lulc-tile-url`, {
          county,
          subcounty: subcounty === "Select subcounty" ? "" : subcounty,
          year,
          layer: "lulc"
        });
        if (live && res.data?.url) {
          setLulcTileUrl(res.data.url);
        }
      } catch (err) {
        console.error("Failed to fetch Dynamic World tile URL:", err);
      } finally {
        if (live) setIsLulcLoading(false);
      }
    };
    fetchLulcTile();
    return () => { live = false; };
  }, [layer, county, subcounty, year]);

  const fallbackGeo = COUNTY_GEOMETRY[county] || COUNTY_GEOMETRY["Kenya"];
  const displayBounds = exactBounds || fallbackGeo?.bounds;

  // Append timestamp parameter to bypass browser disk cache completely
  // Wrapped in useMemo to prevent race conditions on every single re-render
  const tifUrl = useMemo(() => {
    const pYieldParam = predictedYield ? `&predicted_yield=${predictedYield}` : "";
    return `${API_BASE_URL}/api/yield-tif?county=${encodeURIComponent(county)}&year=${year}&subcounty=${encodeURIComponent(subcounty)}&crop=${encodeURIComponent(crop)}&_t=${Date.now()}${pYieldParam}`;
  }, [county, subcounty, year, crop, predictedYield]);

  const getTileUrl = () => {
    switch (layer) {
      case "satellite": case "lulc":
        return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      case "pixel":
        return "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
      default:
        return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    }
  };

  const geojsonKey = `bnd-${county}-${subcounty}-${boundaryGeojson ? "ok" : "none"}`;
  const palette = CROP_PALETTES[crop] ?? CROP_PALETTES.Maize;
  
  // Calculate relative scaling factor (1.0 for national map or fallbacks)
  const scale = useMemo(() => {
    if (county === "Kenya") return 1.0;
    const baseVal = baseYield || CROP_BASE_YIELDS[crop] || 1.5;
    if (predictedYield && baseVal > 0.0) {
      return predictedYield / baseVal;
    }
    return 1.0;
  }, [crop, county, predictedYield, baseYield]);

  const { lo, hi } = useMemo(() => {
    const cropThresholds = CROP_THRESHOLDS[crop] ?? { lo: 1000, hi: 2000 };
    return {
      lo: cropThresholds.lo * scale,
      hi: cropThresholds.hi * scale,
    };
  }, [crop, scale]);

  const loLabel = lo >= 1000 ? `< ${(lo/1000).toFixed(1)} t/ha` : `< ${Math.round(lo)} kg/ha`;
  const hiLabel = hi >= 1000 ? `> ${(hi/1000).toFixed(1)} t/ha` : `> ${Math.round(hi)} kg/ha`;
  const midLabel = `${lo >= 1000 ? (lo/1000).toFixed(1) : Math.round(lo)} - ${hi >= 1000 ? (hi/1000).toFixed(1) : Math.round(hi)} ${lo >= 1000 ? "t/ha" : "kg/ha"}`;

  return (
    <Card className="relative h-full w-full overflow-hidden shadow-soft min-h-[600px] border-none group">
      <MapContainer
        key={`${county}-${subcounty}-${layer}`}
        center={[-0.0236, 37.9062]} zoom={6}
        style={{ height: "100%", width: "100%", background: "#f8f9fa" }}
        zoomControl={false}
      >
        <TileLayer attribution="&copy; OpenStreetMap" url={getTileUrl()} />
        <ZoomControl position="topright" />

        {layer === "pixel" && (
          <GeoTiffLayerComponent url={tifUrl} opacity={opacity} crop={crop} scale={scale} onStatsLoaded={setRasterStats} />
        )}

        {layer === "lulc" && lulcTileUrl && (
          <TileLayer
            key={lulcTileUrl}
            url={lulcTileUrl}
            opacity={opacity}
            zIndex={400}
          />
        )}

        {layer === "lulc" && !lulcTileUrl && lulcMapPath && displayBounds && (
          <ImageOverlay
            key={lulcMapPath}
            url={`${API_BASE_URL}${lulcMapPath}`}
            bounds={displayBounds} opacity={opacity} zIndex={400}
          />
        )}

        {/* Boundary outline – always visible */}
        {boundaryGeojson && (
          <GeoJSON
            key={geojsonKey}
            data={boundaryGeojson}
            style={{
              color: "#10b981", weight: 3, opacity: 1,
              fillColor: "#10b981", fillOpacity: 0.06,
              dashArray: "6, 8",
            }}
          />
        )}

        <MapController
          county={county} subcounty={subcounty}
          setExactBounds={setExactBounds}
          setBoundaryGeojson={setBoundaryGeojson}
        />
        <MapInstanceTracker onMap={setMapInstance} />
      </MapContainer>

      {/* TOP HUD WITH EMBEDDED EXPORT BUTTON */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="bg-slate-900/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3">
          <div className={`${layer === "lulc" ? "bg-amber-600" : "bg-emerald-600"} p-2 rounded-xl shadow-md`}>
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
              {layer === "lulc" ? "Dynamic World Land Cover" : "GeoAI Yield Surface"}
              <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full font-mono uppercase tracking-tighter">
                {layer === "lulc" ? "10m Res" : "0.1km Res"}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {subcounty && subcounty !== "Select subcounty" ? subcounty : county} | {layer === "lulc" ? "Sentinel-2 LULC" : `${crop} Yield`}
            </p>
          </div>

          <div className="pl-3 border-l border-slate-800">
            <MapExportModal
              county={county}
              subcounty={subcounty}
              year={year}
              crop={crop}
              layer={layer}
              opacity={opacity}
              predictedYield={predictedYield}
              baseYield={baseYield}
              palette={palette}
              legendLabels={{ low: loLabel, mid: midLabel, high: hiLabel }}
              mapInstance={mapInstance}
              displayBounds={displayBounds}
            />
          </div>
        </div>
      </div>

      {/* OPACITY SLIDER */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-slate-900/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-700 min-w-[200px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Overlay Opacity</span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range" min="0" max="1" step="0.05" value={opacity}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
      </div>

      {/* LEGEND – pixel mode */}
      {layer === "pixel" && (
        <div className="absolute bottom-6 right-6 z-[1000] bg-slate-900/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-700 min-w-[175px]">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] font-black uppercase text-slate-300 tracking-tighter">Yield Intensity</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: palette.high, boxShadow: `0 0 8px ${palette.glow}` }} />
              <span className="text-[10px] font-bold text-slate-300">High – {hiLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: palette.mid }} />
              <span className="text-[10px] font-bold text-slate-300">Average – {midLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: palette.low }} />
              <span className="text-[10px] font-bold text-slate-300">Low – {loLabel}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 pt-1 border-t border-slate-700/50">
              <div className="w-2.5 h-2.5 rounded-full border border-slate-500 flex-shrink-0" />
              <span className="text-[10px] font-bold text-slate-400">No crop detected</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-2 opacity-50">
            <Info className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <span className="text-[9px] font-medium text-slate-400">SPAM 2017 yield · kg/ha · 0.1km res</span>
          </div>
        </div>
      )}

      {/* LEGEND – lulc mode (Dynamic World) */}
      {layer === "lulc" && (
        <div className="absolute bottom-6 right-6 z-[1000] bg-slate-900/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-700 min-w-[200px] max-h-[300px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-black uppercase text-slate-300 tracking-tighter">Land Cover Classes</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 text-[10px]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: "#E49635" }} />
              <span className="font-bold text-amber-400">Cultivated Crops</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: "#397D49" }} />
              <span className="font-bold text-emerald-400">Trees & Forest</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: "#88B053" }} />
              <span className="font-medium text-slate-300">Grassland</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: "#DFC35A" }} />
              <span className="font-medium text-slate-300">Shrub & Scrub</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: "#C4281B" }} />
              <span className="font-bold text-red-400">Built-up Area</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: "#419BDF" }} />
              <span className="font-medium text-blue-400">Water Body</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: "#7A87C6" }} />
              <span className="font-medium text-indigo-300">Flooded Veg</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded flex-shrink-0" style={{ background: "#A59B8F" }} />
              <span className="font-medium text-stone-400">Bare Ground</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-700 flex items-center gap-2 opacity-60">
            <Info className="h-3 w-3 text-slate-400 flex-shrink-0" />
            <span className="text-[8px] font-medium text-slate-400">Google Dynamic World · Sentinel-2 10m</span>
          </div>
        </div>
      )}
    </Card>
  );
};