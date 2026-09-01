import React, { useState, useEffect, useRef } from "react";
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

interface MapExportModalProps {
  county: string;
  subcounty: string;
  year: number;
  crop: string;
  layer: "osm" | "satellite" | "pixel" | "lulc";
  opacity: number;
  predictedYield?: number;
  baseYield?: number;
  palette?: { low: string; mid: string; high: string; glow: string };
  legendLabels?: { low: string; mid: string; high: string };
  mapInstance?: any;
  displayBounds?: any;
}

export const MapExportModal = ({
  county,
  subcounty,
  year,
  crop,
  layer,
  opacity,
  predictedYield,
  baseYield,
  palette = { low: "#ef4444", mid: "#f59e0b", high: "#10b981", glow: "rgba(16,185,129,0.5)" },
  legendLabels = { low: "< 1.0 t/ha", mid: "1.0 - 2.0 t/ha", high: "> 2.0 t/ha" },
  mapInstance,
  displayBounds
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
  const mapTitle = layer === "lulc" 
    ? "Sentinel-2 Dynamic World 10m Land Use & Land Cover"
    : layer === "pixel" 
    ? `${crop} GeoAI Yield Surface Forecast`
    : layer === "satellite" 
    ? "High-Resolution Satellite Imagery" 
    : "Base Cartographic Reference Map";

  const layerName = layer === "lulc" 
    ? "Dynamic World 10m Near-Real-Time LULC (Sentinel-2)"
    : layer === "pixel" 
    ? `SPAM 2017 Calibrated GeoAI Yield Raster (${crop})`
    : layer === "satellite" 
    ? "ArcGIS World Imagery Satellite Base" 
    : "OpenStreetMap Cartographic Vector Base";

  const spatialResolution = layer === "lulc" ? "10 meters (Sentinel-2 NRT)" : "0.1 km (100 meters Spatial Grid)";
  const nowFormatted = new Date().toLocaleString("en-KE", { 
    dateStyle: "medium", 
    timeStyle: "short",
    timeZone: "Africa/Nairobi" 
  });

  // Fit the whole boundary extent and capture a clean map snapshot
  const captureFullBoundaryMap = async () => {
    setIsCapturingPreview(true);
    try {
      // 1. If map instance and bounds are available, programmatically fit the full county/subcounty extent
      if (mapInstance && displayBounds) {
        mapInstance.fitBounds(displayBounds, { padding: [15, 15], animate: false });
        mapInstance.invalidateSize();
      }

      // 2. Allow Leaflet tiles and WebGL/Canvas to fully render
      await new Promise((r) => setTimeout(r, 450));

      const leafletMapEl = document.querySelector(".leaflet-container") as HTMLElement;
      if (leafletMapEl) {
        const canvas = await html2canvas(leafletMapEl, {
          useCORS: true,
          allowTaint: true,
          scale: 2,
          backgroundColor: "#020617",
          logging: false,
          ignoreElements: (element) => {
            // Remove all default UI controls so map is clean for publication
            return (
              element.classList.contains("leaflet-control-container") ||
              element.classList.contains("leaflet-control-zoom") ||
              element.classList.contains("leaflet-control-attribution")
            );
          },
        });
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

      const exportCanvas = await html2canvas(targetEl, {
        scale: 2,
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
        // Landscape A4 PDF: 297mm x 210mm
        const pdf = new jsPDF("l", "mm", "a4");
        const pageWidth = 297;
        const pageHeight = 210;
        const imgData = exportCanvas.toDataURL("image/png", 1.0);
        
        pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
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

      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 rounded-3xl p-6 z-[99999] shadow-[0_0_90px_rgba(0,0,0,0.95)]">
        <DialogHeader className="border-b border-slate-800 pb-4">
          <DialogTitle className="text-lg font-black tracking-tight text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <span>AgriWatch Map Publisher</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-950/80 text-emerald-400 border-emerald-800 text-[10px] uppercase font-mono">
                Full Boundary Fit
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
          <p className="text-xs text-slate-400 mt-1">
            Export a high-definition official map sheet for {county} {activeSubcounty ? `(${activeSubcounty})` : ""} ({crop} · {year}) automatically fitted to the complete administrative boundary.
          </p>
        </DialogHeader>

        {/* CONTROLS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80 text-xs">
          <div className="space-y-3">
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

          <div className="space-y-2 flex flex-col justify-between">
            <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Format Selection</span>
            <div className="flex items-center gap-3">
              <Button
                variant={exportFormat === "png" ? "default" : "outline"}
                size="sm"
                onClick={() => setExportFormat("png")}
                className={`flex-1 gap-2 font-bold text-xs ${exportFormat === "png" ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30" : "border-slate-700 text-slate-300"}`}
              >
                <ImageIcon className="h-4 w-4" /> PNG Image
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

        {/* PRINT / EXPORT CANVAS (Rendered for capture & live preview) */}
        <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-2xl bg-[#090d16] p-4 text-slate-200">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
            <span>AgriWatch Map Sheet Preview (A4 Landscape Layout)</span>
            <span className="text-emerald-400 font-bold">CRS: EPSG:3857 (WGS 84)</span>
          </div>

          <div 
            ref={printAreaRef} 
            className="w-full bg-[#070b14] border-2 border-slate-700 rounded-xl p-5 space-y-4 shadow-inner relative"
            style={{ minHeight: "450px" }}
          >
            {/* HEADER BLOCK */}
            <div className="border-b-2 border-slate-700 pb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-widest">
                    AgriWatch-KE
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    National Food Security Early Warning System
                  </span>
                </div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">
                  {county} County {activeSubcounty ? `— ${activeSubcounty} Sub-county` : ""}
                </h2>
                <p className="text-xs font-bold text-emerald-400">
                  {mapTitle} · Harvest Year {year}
                </p>
              </div>

              <div className="text-right space-y-1">
                <Badge variant="outline" className="bg-slate-900 border-slate-700 text-slate-300 text-[10px] font-mono">
                  Target Crop: {crop}
                </Badge>
                <p className="text-[9px] font-mono text-slate-500">
                  Generated: {nowFormatted}
                </p>
              </div>
            </div>

            {/* MAP VIEW WITH GRATICULE & EMBEDDED CONTROLS */}
            <div className="relative w-full h-[270px] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              {isCapturingPreview && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-2 text-slate-300">
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">Fitting Full Boundary & Rendering...</span>
                </div>
              )}

              {previewImage ? (
                <img 
                  alt="Live Map Preview" 
                  className="w-full h-full object-cover"
                  src={previewImage}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                  <span className="text-xs font-medium">Capturing full boundary view...</span>
                </div>
              )}

              {/* GRATICULE / COORDINATE GRID OVERLAY */}
              {showGraticule && (
                <div className="absolute inset-0 pointer-events-none border border-slate-600/30">
                  {/* Subtle Grid Lines */}
                  <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 opacity-20">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="border-r border-b border-dashed border-cyan-400" />
                    ))}
                  </div>
                  
                  {/* Corner Coordinates - Carefully Offset to Prevent Overlap */}
                  <span className="absolute top-2 left-2 text-[8px] font-mono bg-slate-900/90 border border-slate-700/80 px-1.5 py-0.5 rounded text-cyan-300 shadow-md">
                    0°30'N, 35°15'E
                  </span>
                  <span className="absolute top-2 right-14 text-[8px] font-mono bg-slate-900/90 border border-slate-700/80 px-1.5 py-0.5 rounded text-cyan-300 shadow-md">
                    0°30'N, 35°45'E
                  </span>
                  <span className="absolute bottom-9 left-2 text-[8px] font-mono bg-slate-900/90 border border-slate-700/80 px-1.5 py-0.5 rounded text-cyan-300 shadow-md">
                    0°00'N, 35°15'E
                  </span>
                  <span className="absolute bottom-2 right-2 text-[8px] font-mono bg-slate-900/90 border border-slate-700/80 px-1.5 py-0.5 rounded text-cyan-300 shadow-md">
                    0°00'N, 35°45'E
                  </span>
                </div>
              )}

              {/* NORTH ARROW (Cleanly Anchored in Top-Right Corner) */}
              {showNorthArrow && (
                <div className="absolute top-2 right-2 bg-slate-900/95 border border-slate-700 rounded-md px-2 py-1 shadow-2xl flex flex-col items-center justify-center pointer-events-none">
                  <Compass className="h-4 w-4 text-emerald-400" />
                  <span className="text-[8px] font-black text-white leading-none mt-0.5">N</span>
                </div>
              )}

              {/* SCALE BAR (Cleanly Anchored at Bottom-Left Corner) */}
              <div className="absolute bottom-2 left-2 bg-slate-900/95 border border-slate-700 px-2 py-1 rounded shadow-lg text-[8px] font-mono text-slate-300 pointer-events-none flex items-center gap-1.5">
                <span>0</span>
                <div className="w-10 h-1 bg-gradient-to-r from-white via-slate-500 to-black border border-slate-400" />
                <span>10 km</span>
              </div>
            </div>

            {/* BOTTOM METADATA & LEGEND PANEL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[9px] items-stretch">
              {/* 1. SYMBOLOGY / LEGEND */}
              {showLegend && (
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="font-black text-slate-300 uppercase tracking-wider block text-[8px] flex items-center gap-1 mb-2">
                      <Layers className="h-3 w-3 text-emerald-400" /> Map Legend
                    </span>

                    {layer === "pixel" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: palette.high }} />
                          <span className="text-slate-300 font-medium">High: {legendLabels.high}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: palette.mid }} />
                          <span className="text-slate-300 font-medium">Average: {legendLabels.mid}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: palette.low }} />
                          <span className="text-slate-300 font-medium">Low: {legendLabels.low}</span>
                        </div>
                      </div>
                    )}

                    {layer === "lulc" && (
                      <div className="grid grid-cols-2 gap-1.5 text-[8px]">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{background: "#E49635"}} /><span className="text-amber-300 font-bold">Crops</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{background: "#397D49"}} /><span className="text-emerald-400 font-medium">Forest</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{background: "#88B053"}} /><span className="text-slate-300 font-medium">Grass</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{background: "#C4281B"}} /><span className="text-red-400 font-bold">Built-up</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{background: "#419BDF"}} /><span className="text-blue-400 font-medium">Water</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{background: "#DFC35A"}} /><span className="text-slate-300 font-medium">Shrub</span></div>
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
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-between font-mono">
                  <div>
                    <span className="font-black text-slate-300 uppercase tracking-wider block text-[8px] flex items-center gap-1 mb-2">
                      <Info className="h-3 w-3 text-blue-400" /> Spatial Specifications
                    </span>
                    <p className="text-slate-400 mb-1"><strong className="text-slate-200 font-sans">Layer:</strong> {layerName}</p>
                    <p className="text-slate-400 mb-1"><strong className="text-slate-200 font-sans">Opacity:</strong> {Math.round(opacity * 100)}% overlay transparency</p>
                    <p className="text-slate-400 mb-1"><strong className="text-slate-200 font-sans">Resolution:</strong> {spatialResolution}</p>
                    <p className="text-slate-400"><strong className="text-slate-200 font-sans">Projection:</strong> WGS 84 / Pseudo-Mercator (EPSG:3857)</p>
                  </div>
                </div>
              )}

              {/* 3. SOURCES & CITATIONS */}
              {showMetadata && (
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-between text-[8px]">
                  <div>
                    <span className="font-black text-slate-300 uppercase tracking-wider block flex items-center gap-1 text-[8px] mb-2">
                      <Check className="h-3 w-3 text-emerald-400" /> Data Sources & Models
                    </span>
                    <p className="text-slate-400 mb-1">
                      <strong className="text-slate-300">Ground-truth:</strong> Ministry of Agriculture / AFA Kenya.
                    </p>
                    <p className="text-slate-400 mb-1">
                      <strong className="text-slate-300">Remote Sensing:</strong> Google Earth Engine (CHIRPS, MODIS, Dynamic World V1).
                    </p>
                    <p className="text-slate-400">
                      <strong className="text-slate-300">Predictor:</strong> XGBoost ML Regressor (County-level tuned).
                    </p>
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
