import React, { useState, useEffect, useRef, useMemo } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { 
  Download, 
  FileText, 
  Image as ImageIcon, 
  Compass, 
  Grid, 
  Layers, 
  Info, 
  Check, 
  Loader2, 
  Sparkles,
  RefreshCw,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SOIL_LAYER_META: Record<string, { label: string; desc: string; unit: string; lowLabel: string; midLabel: string; highLabel: string }> = {
  composite: { label: "RGB Composite (Clay/Sand/SOC)", desc: "Red: Clay · Green: Organic Carbon · Blue: Sand", unit: "Spectral Composite", lowLabel: "High Sand", midLabel: "Balanced", highLabel: "High Clay/SOC" },
  texture: { label: "Soil Texture (USDA 12-Class)", desc: "USDA 12-class textural taxonomy", unit: "Textural Class", lowLabel: "Coarse / Sand", midLabel: "Loam / Silt", highLabel: "Fine / Clay" },
  ph: { label: "Soil pH (Topsoil 0-20cm)", desc: "Acidity and alkalinity index (H2O)", unit: "pH units", lowLabel: "Acidic (< 5.5)", midLabel: "Optimal (5.5 - 7.0)", highLabel: "Alkaline (> 7.0)" },
  soc: { label: "Soil Organic Carbon (SOC)", desc: "Organic matter stock in topsoil", unit: "g/kg", lowLabel: "Low (< 1.5%)", midLabel: "Moderate (1.5 - 2.5%)", highLabel: "Rich (> 2.5%)" },
  nitrogen: { label: "Total Nitrogen (N)", desc: "Total soil nitrogen concentration", unit: "cg/kg", lowLabel: "Low (< 0.15%)", midLabel: "Medium (0.15 - 0.25%)", highLabel: "High (> 0.25%)" },
  clay: { label: "Clay Content (%)", desc: "Mineral soil particles < 0.002 mm", unit: "%", lowLabel: "Sandy (< 20%)", midLabel: "Loam (20 - 35%)", highLabel: "Heavy Clay (> 35%)" },
  sand: { label: "Sand Content (%)", desc: "Mineral soil particles 0.05 - 2.0 mm", unit: "%", lowLabel: "Low Sand (< 30%)", midLabel: "Medium (30 - 55%)", highLabel: "Sandy (> 55%)" },
  cec: { label: "Cation Exchange Capacity (CEC)", desc: "Soil nutrient holding capability", unit: "cmol(+)/kg", lowLabel: "Low (< 15 cmol)", midLabel: "Medium (15 - 25 cmol)", highLabel: "High (> 25 cmol)" },
};

interface MapExportModalProps {
  county: string;
  subcounty: string;
  year?: number;
  crop?: string;
  layer: "osm" | "satellite" | "pixel" | "lulc" | "soil";
  opacity: number;
  predictedYield?: number;
  baseYield?: number;
  palette?: { low: string; mid: string; high: string; glow: string };
  legendLabels?: { low: string; mid: string; high: string };
  mapInstance?: any;
  displayBounds?: any;
  soilLayer?: string;
}

export const MapExportModal = ({
  county,
  subcounty,
  year = 2026,
  crop = "Diagnostics",
  layer,
  opacity,
  predictedYield,
  baseYield,
  palette = { low: "#ef4444", mid: "#f59e0b", high: "#10b981", glow: "rgba(16,185,129,0.5)" },
  legendLabels = { low: "< 1.0 t/ha", mid: "1.0 - 2.0 t/ha", high: "> 2.0 t/ha" },
  mapInstance,
  displayBounds,
  soilLayer = "composite"
}: MapExportModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCapturingPreview, setIsCapturingPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"png" | "pdf">("png");

  // Cartographic toggles
  const [showGraticule, setShowGraticule] = useState(true);
  const [showNorthArrow, setShowNorthArrow] = useState(true);
  const [showMetadata, setShowMetadata] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const activeSubcounty = subcounty && subcounty !== "Select subcounty" ? subcounty : "";
  const currentSoilMeta = SOIL_LAYER_META[soilLayer] || SOIL_LAYER_META.composite;

  const mapTitle = layer === "soil"
    ? `GeoAI Soil Surface Diagnostics — ${currentSoilMeta.label}`
    : layer === "lulc" 
    ? "Sentinel-2 Dynamic World 10m Land Use & Land Cover"
    : layer === "pixel" 
    ? `${crop} GeoAI Yield Surface Forecast`
    : layer === "satellite" 
    ? "High-Resolution Satellite Imagery" 
    : "Base Cartographic Reference Map";

  const layerName = layer === "soil"
    ? `OpenLandMap & ISRIC SoilGrids 30m (${currentSoilMeta.label})`
    : layer === "lulc" 
    ? "Dynamic World 10m Near-Real-Time LULC (Sentinel-2)"
    : layer === "pixel" 
    ? `SPAM 2017 Calibrated GeoAI Yield Raster (${crop})`
    : layer === "satellite" 
    ? "ArcGIS World Imagery Satellite Base" 
    : "OpenStreetMap Cartographic Vector Base";

  const spatialResolution = layer === "soil"
    ? "30 meters (Ensemble Soil Machine Learning Model)"
    : layer === "lulc" 
    ? "10 meters (Sentinel-2 NRT)" 
    : "0.1 km (100 meters Spatial Grid)";

  const nowFormatted = new Date().toLocaleString("en-KE", { 
    dateStyle: "medium", 
    timeStyle: "short",
    timeZone: "Africa/Nairobi" 
  });

  // Dynamic corner coordinates calculated from displayBounds
  const formatDms = (val: any, isLat: boolean) => {
    if (typeof val !== "number" || isNaN(val)) {
      return isLat ? "0°00'N" : "35°00'E";
    }
    const dir = isLat ? (val >= 0 ? "N" : "S") : (val >= 0 ? "E" : "W");
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const min = Math.round((abs - deg) * 60);
    return `${deg}°${min.toString().padStart(2, "0")}'${dir}`;
  };

  const activeBnds = useMemo(() => {
    if (displayBounds && Array.isArray(displayBounds) && displayBounds.length >= 2) {
      const p0 = displayBounds[0];
      const p1 = displayBounds[1];
      const south = typeof p0 === "object" && p0 !== null ? (Array.isArray(p0) ? p0[0] : (p0.lat ?? -0.02)) : -0.02;
      const west = typeof p0 === "object" && p0 !== null ? (Array.isArray(p0) ? p0[1] : (p0.lng ?? 34.85)) : 34.85;
      const north = typeof p1 === "object" && p1 !== null ? (Array.isArray(p1) ? p1[0] : (p1.lat ?? 0.95)) : 0.95;
      const east = typeof p1 === "object" && p1 !== null ? (Array.isArray(p1) ? p1[1] : (p1.lng ?? 35.59)) : 35.59;
      return { south, west, north, east };
    }
    return { south: -0.02, north: 0.95, west: 34.85, east: 35.59 };
  }, [displayBounds]);

  const nwCoord = `${formatDms(activeBnds.north, true)}, ${formatDms(activeBnds.west, false)}`;
  const neCoord = `${formatDms(activeBnds.north, true)}, ${formatDms(activeBnds.east, false)}`;
  const swCoord = `${formatDms(activeBnds.south, true)}, ${formatDms(activeBnds.west, false)}`;
  const seCoord = `${formatDms(activeBnds.south, true)}, ${formatDms(activeBnds.east, false)}`;

  // Intermediate graticule neatline ticks (matching official GIS atlas maps)
  const lonTicks = useMemo(() => {
    const { west, east } = activeBnds;
    const step = (east - west) / 4;
    return [0, 1, 2, 3, 4].map((i) => ({
      val: west + step * i,
      pct: (i / 4) * 100,
      label: formatDms(west + step * i, false)
    }));
  }, [activeBnds]);

  const latTicks = useMemo(() => {
    const { south, north } = activeBnds;
    const step = (north - south) / 4;
    return [0, 1, 2, 3, 4].map((i) => ({
      val: north - step * i,
      pct: (i / 4) * 100,
      label: formatDms(north - step * i, true)
    }));
  }, [activeBnds]);

  // Dynamically compute exact undistorted map frame dimensions based on true geographic AOI aspect ratio
  const mapFrameDims = useMemo(() => {
    const latSpan = Math.abs(activeBnds.north - activeBnds.south);
    const lonSpan = Math.abs(activeBnds.east - activeBnds.west);
    const midLat = (activeBnds.north + activeBnds.south) / 2;
    const wKm = lonSpan * 111.32 * Math.cos((midLat * Math.PI) / 180);
    const hKm = latSpan * 110.57;
    const aspect = hKm > 0 ? wKm / hKm : 0.79;

    // Available space inside the A4 sheet viewport
    const maxH = 505;
    const maxW = 940;

    let targetH = maxH;
    let targetW = Math.round(targetH * aspect);

    if (targetW > maxW) {
      targetW = maxW;
      targetH = Math.round(targetW / aspect);
    }

    const kmPerCm = targetW > 0 ? Math.round((37.8 * wKm) / targetW) : 7;

    return {
      width: Math.max(260, targetW),
      height: Math.max(260, targetH),
      aspect,
      wKm: Math.round(wKm),
      hKm: Math.round(hKm),
      kmPerCm: Math.max(1, kmPerCm)
    };
  }, [activeBnds]);

  // Fit the whole boundary extent and capture ONLY the Area of Interest (AOI)
  const captureFullBoundaryMap = async () => {
    setIsCapturingPreview(true);
    try {
      // 1. Programmatically fit the full county/subcounty extent in Leaflet
      if (mapInstance && displayBounds) {
        mapInstance.fitBounds(displayBounds, { padding: [10, 10], animate: false });
        mapInstance.invalidateSize();
      }

      // 2. Allow Leaflet tiles and WebGL/Canvas to fully settle
      await new Promise((r) => setTimeout(r, 750));

      const leafletMapEl = mapInstance ? mapInstance.getContainer() : (document.querySelector(".leaflet-container") as HTMLElement);
      if (leafletMapEl) {
        const canvas = await html2canvas(leafletMapEl, {
          useCORS: true,
          allowTaint: true,
          scale: 2.5,
          backgroundColor: "#020617",
          logging: false,
          ignoreElements: (element) => {
            return (
              element.classList.contains("leaflet-control-container") ||
              element.classList.contains("leaflet-control-zoom") ||
              element.classList.contains("leaflet-control-attribution")
            );
          },
        });

        // 3. Extract EXCLUSIVELY the Area of Interest (AOI) bounding box so the county fills the entire frame
        if (mapInstance && displayBounds) {
          try {
            const south = activeBnds.south;
            const west = activeBnds.west;
            const north = activeBnds.north;
            const east = activeBnds.east;

            const nwPt = mapInstance.latLngToContainerPoint([north, west]);
            const sePt = mapInstance.latLngToContainerPoint([south, east]);

            const minX = Math.min(nwPt.x, sePt.x);
            const maxX = Math.max(nwPt.x, sePt.x);
            const minY = Math.min(nwPt.y, sePt.y);
            const maxY = Math.max(nwPt.y, sePt.y);

            const rawW = maxX - minX;
            const rawH = maxY - minY;

            if (rawW > 25 && rawH > 25) {
              // 2.5% aesthetic cartographic neatline padding
              const padX = rawW * 0.025;
              const padY = rawH * 0.025;

              const cropX = Math.max(0, minX - padX);
              const cropY = Math.max(0, minY - padY);
              const cropW = Math.min(leafletMapEl.clientWidth - cropX, rawW + padX * 2);
              const cropH = Math.min(leafletMapEl.clientHeight - cropY, rawH + padY * 2);

              const scaleX = canvas.width / leafletMapEl.clientWidth;
              const scaleY = canvas.height / leafletMapEl.clientHeight;
              const sx = Math.floor(cropX * scaleX);
              const sy = Math.floor(cropY * scaleY);
              const sw = Math.floor(cropW * scaleX);
              const sh = Math.floor(cropH * scaleY);

              const aoiCanvas = document.createElement("canvas");
              aoiCanvas.width = sw;
              aoiCanvas.height = sh;
              const ctx = aoiCanvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
                setPreviewImage(aoiCanvas.toDataURL("image/png"));
                return;
              }
            }
          } catch (cropErr) {
            console.warn("AOI Crop fallback:", cropErr);
          }
        }

        // Fallback to full canvas
        setPreviewImage(canvas.toDataURL("image/png"));
      }
    } catch (err) {
      console.error("Full boundary map capture failed:", err);
    } finally {
      setIsCapturingPreview(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      captureFullBoundaryMap();
    } else {
      setPreviewImage(null);
    }
  }, [isOpen, county, subcounty, crop, year, layer, opacity]);

  const handleExport = async (format: "png" | "pdf") => {
    setIsExporting(true);
    try {
      const targetEl = printAreaRef.current;
      if (!targetEl) throw new Error("Print area reference not found");

      // High-resolution capture (scale 2.5 delivers crisp ~300 DPI publication quality)
      const exportCanvas = await html2canvas(targetEl, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#070b14",
        logging: false,
      });

      const fileName = `AgriWatch_${county.replace(/\s+/g, "_")}_${crop}_${year}_${layer.toUpperCase()}`;

      if (format === "png") {
        const link = document.createElement("a");
        link.download = `${fileName}.png`;
        link.href = exportCanvas.toDataURL("image/png", 1.0);
        link.click();
      } else {
        // Landscape A4 PDF: exactly 297mm x 210mm matching the 297:210 aspect ratio
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
          compress: true,
        });
        const pageWidth = 297;
        const pageHeight = 210;
        const imgData = exportCanvas.toDataURL("image/png", 1.0);
        
        pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
        pdf.save(`${fileName}.pdf`);
      }

      setIsOpen(false);
    } catch (err) {
      console.error("Map export failed:", err);
      alert("Export failed. Please check browser permissions and try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-slate-900/95 hover:bg-slate-800 text-slate-200 border-slate-700 shadow-xl backdrop-blur-md gap-2 font-bold text-xs"
        >
          <Download className="h-3.5 w-3.5 text-emerald-400" />
          Export Map
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 rounded-3xl p-6 z-[99999] shadow-[0_0_90px_rgba(0,0,0,0.95)]">
        <DialogHeader className="border-b border-slate-800 pb-3">
          <DialogTitle className="text-lg font-black tracking-tight text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <span>AgriWatch Map Publisher</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-950/80 text-emerald-400 border-emerald-800 text-[10px] uppercase font-mono">
                A4 Landscape Full Extent
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={captureFullBoundaryMap}
                disabled={isCapturingPreview}
                className="h-7 px-2 text-slate-400 hover:text-white"
                title="Refresh Map Preview"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isCapturingPreview ? "animate-spin text-emerald-400" : ""}`} />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* MAP OPTIONS & CONFIGURATION BAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2 border-b border-slate-800/80">
          <div className="space-y-1.5">
            <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Map Elements & Overlays</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <Switch id="graticule-toggle" checked={showGraticule} onCheckedChange={setShowGraticule} />
                <Label htmlFor="graticule-toggle" className="text-xs cursor-pointer text-slate-300">Lat/Long Grid</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="arrow-toggle" checked={showNorthArrow} onCheckedChange={setShowNorthArrow} />
                <Label htmlFor="arrow-toggle" className="text-xs cursor-pointer text-slate-300">North Arrow</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="legend-toggle" checked={showLegend} onCheckedChange={setShowLegend} />
                <Label htmlFor="legend-toggle" className="text-xs cursor-pointer text-slate-300">Color Legend</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="meta-toggle" checked={showMetadata} onCheckedChange={setShowMetadata} />
                <Label htmlFor="meta-toggle" className="text-xs cursor-pointer text-slate-300">Sources & Meta</Label>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 flex flex-col justify-between">
            <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Format Selection</span>
            <div className="flex items-center gap-3">
              <Button
                variant={exportFormat === "png" ? "default" : "outline"}
                size="sm"
                onClick={() => setExportFormat("png")}
                className={`flex-1 gap-2 font-bold text-xs ${exportFormat === "png" ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30" : "border-slate-700 text-slate-300"}`}
              >
                <ImageIcon className="h-4 w-4" /> PNG Image (300 DPI)
              </Button>
              <Button
                variant={exportFormat === "pdf" ? "default" : "outline"}
                size="sm"
                onClick={() => setExportFormat("pdf")}
                className={`flex-1 gap-2 font-bold text-xs ${exportFormat === "pdf" ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30" : "border-slate-700 text-slate-300"}`}
              >
                <FileText className="h-4 w-4" /> A4 PDF Document
              </Button>
            </div>
          </div>
        </div>

        {/* PRINT / EXPORT CANVAS (Rendered with exact A4 Landscape 297:210 aspect ratio) */}
        <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-2xl bg-[#090d16] p-3 text-slate-200">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
            <span>A4 Landscape Map Preview (Map Fills Entire Sheet)</span>
            <span className="text-emerald-400 font-bold">CRS: EPSG:4326 · 1:1 Aspect Ratio</span>
          </div>

          <div 
            ref={printAreaRef} 
            className="w-full bg-[#070b14] border-2 border-slate-700 rounded-xl p-4 flex flex-col justify-between shadow-inner relative overflow-hidden"
            style={{ aspectRatio: "297 / 210", minHeight: "520px" }}
          >
            {/* COMPACT SLIM HEADER */}
            <div className="border-b border-slate-700/90 pb-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest shadow-sm">
                  AgriWatch-KE
                </span>
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-tight leading-none">
                    {county} County {activeSubcounty ? `— ${activeSubcounty} Sub-county` : ""}
                  </h2>
                  <p className="text-[11px] font-bold text-emerald-400 leading-none mt-1">
                    {mapTitle} · Harvest Year {year}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-slate-900/90 border-slate-700 text-slate-200 text-[10px] font-mono px-2 py-0.5">
                  Crop: <strong className="text-emerald-400 ml-1 font-bold">{crop}</strong>
                </Badge>
                <span className="text-[9px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                  {nowFormatted}
                </span>
              </div>
            </div>

            {/* MASSIVE HERO MAP VIEW (Only Area of Interest, Zero Distortion) */}
            <div className="flex-1 my-2 min-h-[500px] relative w-full flex items-center justify-center overflow-hidden">
              <div 
                className="relative bg-slate-950 rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl flex items-center justify-center"
                style={{
                  width: `${mapFrameDims.width}px`,
                  height: `${mapFrameDims.height}px`,
                  maxWidth: "100%",
                  maxHeight: "100%",
                }}
              >
                {isCapturingPreview && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-2 text-slate-300">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">Extracting Area of Interest (AOI)...</span>
                  </div>
                )}

                {previewImage ? (
                  <img 
                    alt="Area of Interest Map" 
                    src={previewImage}
                    style={{
                      width: `${mapFrameDims.width}px`,
                      height: `${mapFrameDims.height}px`,
                      display: "block",
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                    <span className="text-xs font-medium">Capturing Area of Interest...</span>
                  </div>
                )}

                {/* IN-MAP TITLE (Top-Left matching official atlas presentation) */}
                <div className="absolute top-2.5 left-2.5 z-10 bg-slate-950/85 backdrop-blur-sm border border-slate-700/80 px-2.5 py-1 rounded shadow-xl pointer-events-none">
                  <h3 className="text-xs font-black text-emerald-400 uppercase tracking-tight leading-none">
                    {county} County {activeSubcounty ? `— ${activeSubcounty}` : ""}
                  </h3>
                  <p className="text-[8px] font-mono text-slate-300 mt-0.5">
                    AOI Extent · {year}
                  </p>
                </div>

                {/* NEATLINE GRATICULE & TICK LABELS */}
                {showGraticule && (
                  <div className="absolute inset-0 pointer-events-none border border-slate-600/50">
                    {/* Subtle Grid Lines */}
                    <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-15">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="border-r border-b border-dashed border-cyan-400" />
                      ))}
                    </div>
                    
                    {/* Top Longitude Ticks */}
                    <div className="absolute top-0 inset-x-0 flex justify-between px-3 pt-0.5 text-[7px] font-mono text-cyan-300 bg-slate-950/70 border-b border-slate-700/60">
                      {lonTicks.map((t, idx) => (
                        <span key={idx} className="tracking-tighter">{t.label}</span>
                      ))}
                    </div>

                    {/* Bottom Longitude Ticks */}
                    <div className="absolute bottom-0 inset-x-0 flex justify-between px-3 pb-0.5 text-[7px] font-mono text-cyan-300 bg-slate-950/70 border-t border-slate-700/60">
                      {lonTicks.map((t, idx) => (
                        <span key={idx} className="tracking-tighter">{t.label}</span>
                      ))}
                    </div>

                    {/* Left Latitude Ticks */}
                    <div className="absolute left-0 inset-y-0 flex flex-col justify-between py-4 pl-0.5 text-[7px] font-mono text-cyan-300 bg-slate-950/70 border-r border-slate-700/60">
                      {latTicks.map((t, idx) => (
                        <span key={idx} className="tracking-tighter">{t.label}</span>
                      ))}
                    </div>

                    {/* Right Latitude Ticks */}
                    <div className="absolute right-0 inset-y-0 flex flex-col justify-between py-4 pr-0.5 text-[7px] font-mono text-cyan-300 bg-slate-950/70 border-l border-slate-700/60">
                      {latTicks.map((t, idx) => (
                        <span key={idx} className="tracking-tighter">{t.label}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* NORTH ARROW (Anchored in Top-Right) */}
                {showNorthArrow && (
                  <div className="absolute top-2.5 right-2.5 bg-slate-900/95 border border-slate-700 rounded-md px-1.5 py-1 shadow-2xl flex flex-col items-center justify-center pointer-events-none z-10">
                    <Compass className="h-4 w-4 text-emerald-400" />
                    <span className="text-[8px] font-black text-white leading-none mt-0.5">N</span>
                  </div>
                )}

                {/* CARTOGRAPHIC SCALE BAR (Anchored in Bottom-Left matching user reference) */}
                <div className="absolute bottom-3 left-3 bg-slate-950/90 border border-slate-700 px-2.5 py-1 rounded shadow-2xl text-[7.5px] font-mono text-slate-200 pointer-events-none z-10 flex flex-col gap-0.5">
                  <span className="font-bold text-slate-300 text-[7px]">1 cm ≈ {mapFrameDims.kmPerCm} km</span>
                  <div className="flex items-center gap-1">
                    <span>0</span>
                    <div className="w-14 h-1.5 bg-gradient-to-r from-white via-slate-800 to-white border border-slate-400 flex">
                      <div className="w-1/4 h-full bg-black border-r border-slate-400" />
                      <div className="w-1/4 h-full bg-white border-r border-slate-400" />
                      <div className="w-1/4 h-full bg-black border-r border-slate-400" />
                      <div className="w-1/4 h-full bg-white" />
                    </div>
                    <span>20 km</span>
                  </div>
                  <span className="text-[6.5px] text-slate-400 font-bold tracking-widest text-center uppercase">Kilometers</span>
                </div>
              </div>
            </div>

            {/* BOTTOM METADATA & LEGEND PANEL (Restored 3-card layout) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[8.5px] items-stretch flex-shrink-0 pt-1.5 border-t border-slate-800">
              {/* 1. SYMBOLOGY / LEGEND */}
              {showLegend && (
                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="font-black text-slate-300 uppercase tracking-wider block text-[8px] flex items-center gap-1 mb-1.5">
                      <Layers className="h-3 w-3 text-emerald-400" /> Map Legend
                    </span>

                    {layer === "soil" && (
                      <div className="space-y-1">
                        <div className="text-[7.5px] font-mono text-slate-400 mb-1">
                          Diagnostic: <strong className="text-emerald-400">{currentSoilMeta.label}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: palette.high }} />
                          <span className="text-slate-200 font-medium">{currentSoilMeta.highLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: palette.mid }} />
                          <span className="text-slate-200 font-medium">{currentSoilMeta.midLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: palette.low }} />
                          <span className="text-slate-200 font-medium">{currentSoilMeta.lowLabel}</span>
                        </div>
                      </div>
                    )}

                    {layer === "pixel" && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: palette.high }} />
                          <span className="text-slate-200 font-medium">High: {legendLabels.high}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: palette.mid }} />
                          <span className="text-slate-200 font-medium">Average: {legendLabels.mid}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ background: palette.low }} />
                          <span className="text-slate-200 font-medium">Low: {legendLabels.low}</span>
                        </div>
                      </div>
                    )}

                    {layer === "lulc" && (
                      <div className="grid grid-cols-2 gap-1 text-[7.5px]">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#E49635"}} /><span className="text-amber-300 font-bold">Crops</span></div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#397D49"}} /><span className="text-emerald-400 font-medium">Forest</span></div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#88B053"}} /><span className="text-slate-300 font-medium">Grass</span></div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#C4281B"}} /><span className="text-red-400 font-bold">Built-up</span></div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#419BDF"}} /><span className="text-blue-400 font-medium">Water</span></div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#DFC35A"}} /><span className="text-slate-300 font-medium">Shrub</span></div>
                      </div>
                    )}

                    {(layer === "osm" || layer === "satellite") && (
                      <p className="text-slate-400 italic text-[8px]">Administrative county boundary and reference base cartography.</p>
                    )}
                  </div>
                </div>
              )}

              {/* 2. TECHNICAL SPECIFICATIONS */}
              {showMetadata && (
                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl flex flex-col justify-between font-mono">
                  <div>
                    <span className="font-black text-slate-300 uppercase tracking-wider block text-[8px] flex items-center gap-1 mb-1.5">
                      <Info className="h-3 w-3 text-blue-400" /> Spatial Specifications
                    </span>
                    <p className="text-slate-400 mb-0.5"><strong className="text-slate-200 font-sans">Layer:</strong> {layerName}</p>
                    <p className="text-slate-400 mb-0.5"><strong className="text-slate-200 font-sans">Opacity:</strong> {Math.round(opacity * 100)}% overlay transparency</p>
                    <p className="text-slate-400 mb-0.5"><strong className="text-slate-200 font-sans">Resolution:</strong> {spatialResolution}</p>
                    <p className="text-slate-400"><strong className="text-slate-200 font-sans">Geographic CRS:</strong> WGS 84 (EPSG:4326)</p>
                  </div>
                </div>
              )}

              {/* 3. SOURCES & CITATIONS */}
              {showMetadata && (
                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl flex flex-col justify-between text-[8px]">
                  <div>
                    <span className="font-black text-slate-300 uppercase tracking-wider block flex items-center gap-1 text-[8px] mb-1.5">
                      <Check className="h-3 w-3 text-emerald-400" /> Data Sources & Models
                    </span>
                    {layer === "soil" ? (
                      <>
                        <p className="text-slate-400 mb-0.5">
                          <strong className="text-slate-300">Ground-truth:</strong> KALRO Kenya Soil Survey & ISRIC.
                        </p>
                        <p className="text-slate-400 mb-0.5">
                          <strong className="text-slate-300">Remote Sensing:</strong> Sentinel-2 Multispectral & OpenLandMap 250m.
                        </p>
                        <p className="text-slate-400">
                          <strong className="text-slate-300">Predictor:</strong> Random Forest Soil Ensemble (30m).
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-slate-400 mb-0.5">
                          <strong className="text-slate-300">Ground-truth:</strong> Ministry of Agriculture / AFA Kenya.
                        </p>
                        <p className="text-slate-400 mb-0.5">
                          <strong className="text-slate-300">Remote Sensing:</strong> Google Earth Engine (CHIRPS, MODIS, Dynamic World).
                        </p>
                        <p className="text-slate-400">
                          <strong className="text-slate-300">Predictor:</strong> XGBoost ML Regressor (County-level tuned).
                        </p>
                      </>
                    )}
                  </div>
                  <p className="text-slate-500 italic pt-1 border-t border-slate-800/80 text-[7.5px]">
                    AgriWatch-KE · Decision Support Bulletin
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isExporting || isCapturingPreview}
              onClick={() => handleExport("png")}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 gap-2 font-bold text-xs"
            >
              {isExporting && exportFormat === "png" ? <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> : <ImageIcon className="h-4 w-4 text-emerald-400" />}
              Download PNG Image
            </Button>

            <Button
              size="sm"
              disabled={isExporting || isCapturingPreview}
              onClick={() => handleExport("pdf")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-bold text-xs shadow-lg shadow-emerald-900/30"
            >
              {isExporting && exportFormat === "pdf" ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <FileText className="h-4 w-4 text-white" />}
              Download A4 PDF Sheet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
