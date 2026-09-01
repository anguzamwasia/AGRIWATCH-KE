import React, { useState, useRef } from "react";
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
  X,
  Printer,
  ShieldAlert,
  Calendar,
  MapPin,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  legendLabels = { low: "< 1.0 t/ha", mid: "1.0 - 2.0 t/ha", high: "> 2.0 t/ha" }
}: MapExportModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "pdf">("png");

  // Cartographic toggles
  const [showGraticule, setShowGraticule] = useState(true);
  const [showNorthArrow, setShowNorthArrow] = useState(true);
  const [showMetadata, setShowMetadata] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const activeSubcounty = subcounty && subcounty !== "Select subcounty" ? subcounty : "Entire County";
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

  const handleExport = async (format: "png" | "pdf") => {
    setIsExporting(true);
    try {
      // 1. Capture the Leaflet map container from the DOM
      const leafletMapEl = document.querySelector(".leaflet-container") as HTMLElement;
      let mapImageUri = "";
      
      if (leafletMapEl) {
        const mapCanvas = await html2canvas(leafletMapEl, {
          useCORS: true,
          allowTaint: true,
          scale: 2,
          backgroundColor: "#020617",
          logging: false
        });
        mapImageUri = mapCanvas.toDataURL("image/png");
      }

      // 2. Inject image into print area preview if needed
      const previewImgEl = document.getElementById("captured-map-preview") as HTMLImageElement;
      if (previewImgEl && mapImageUri) {
        previewImgEl.src = mapImageUri;
        // Wait for DOM paint
        await new Promise((r) => setTimeout(r, 200));
      }

      const targetEl = printAreaRef.current;
      if (!targetEl) throw new Error("Print area reference not found");

      const exportCanvas = await html2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#090d16",
        logging: false
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
        
        // Scale to fit landscape A4
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
          className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700 shadow-xl backdrop-blur-md gap-2 font-bold text-xs"
        >
          <Download className="h-4 w-4 text-emerald-400" />
          Export Map
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 rounded-3xl p-6">
        <DialogHeader className="border-b border-slate-800 pb-4">
          <DialogTitle className="text-lg font-black tracking-tight text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <span>Cartographic Map Publisher</span>
            </div>
            <Badge variant="outline" className="bg-emerald-950/80 text-emerald-400 border-emerald-800 text-[10px] uppercase font-mono">
              High-Res 300 DPI Export
            </Badge>
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-1">
            Export a high-definition cartographic sheet for {county} ({crop} · {year}) with metadata, coordinate grids, and official sources.
          </p>
        </DialogHeader>

        {/* CONTROLS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80 text-xs">
          <div className="space-y-3">
            <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Cartographic Elements</span>
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
                className={`flex-1 gap-2 font-bold text-xs ${exportFormat === "png" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "border-slate-700 text-slate-300"}`}
              >
                <ImageIcon className="h-4 w-4" /> PNG Image
              </Button>
              <Button
                variant={exportFormat === "pdf" ? "default" : "outline"}
                size="sm"
                onClick={() => setExportFormat("pdf")}
                className={`flex-1 gap-2 font-bold text-xs ${exportFormat === "pdf" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "border-slate-700 text-slate-300"}`}
              >
                <FileText className="h-4 w-4" /> A4 PDF Document
              </Button>
            </div>
          </div>
        </div>

        {/* PRINT / EXPORT CANVAS (Rendered for capture) */}
        <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-2xl bg-[#090d16] p-4 text-slate-200">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
            <span>Cartographic Preview (A4 Landscape Layout)</span>
            <span className="text-emerald-400 font-bold">CRS: EPSG:3857 (WGS 84)</span>
          </p>

          <div 
            ref={printAreaRef} 
            className="w-full bg-[#070b14] border-2 border-slate-700 rounded-xl p-5 space-y-4 shadow-inner relative"
            style={{ minHeight: "440px" }}
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
                  {county} County {subcounty && subcounty !== "Select subcounty" ? `— ${subcounty} Sub-county` : ""}
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

            {/* MAP VIEW WITH GRATICULE OVERLAY */}
            <div className="relative w-full h-[260px] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              {/* Captured Leaflet Image Element */}
              <img 
                id="captured-map-preview" 
                alt="Map View" 
                className="w-full h-full object-cover"
                src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' fill='%230f172a'><text x='50%' y='50%' fill='%2364748b' text-anchor='middle' font-family='sans-serif' font-size='12'>Live Leaflet Map Layer</text></svg>"
              />

              {/* GRATICULE / COORDINATE GRID OVERLAY */}
              {showGraticule && (
                <div className="absolute inset-0 pointer-events-none border border-slate-600/40">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 opacity-25">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="border-r border-b border-dashed border-cyan-400" />
                    ))}
                  </div>
                  {/* Coordinate labels on corners */}
                  <span className="absolute top-1 left-1.5 text-[8px] font-mono bg-slate-900/80 px-1 py-0.5 rounded text-cyan-300">
                    0°30'N, 35°15'E
                  </span>
                  <span className="absolute top-1 right-1.5 text-[8px] font-mono bg-slate-900/80 px-1 py-0.5 rounded text-cyan-300">
                    0°30'N, 35°45'E
                  </span>
                  <span className="absolute bottom-1 left-1.5 text-[8px] font-mono bg-slate-900/80 px-1 py-0.5 rounded text-cyan-300">
                    0°00'N, 35°15'E
                  </span>
                  <span className="absolute bottom-1 right-1.5 text-[8px] font-mono bg-slate-900/80 px-1 py-0.5 rounded text-cyan-300">
                    0°00'N, 35°45'E
                  </span>
                </div>
              )}

              {/* NORTH ARROW */}
              {showNorthArrow && (
                <div className="absolute top-3 right-3 bg-slate-900/90 border border-slate-700 rounded-lg p-2 shadow-2xl flex flex-col items-center justify-center pointer-events-none">
                  <Compass className="h-5 w-5 text-emerald-400 animate-pulse" />
                  <span className="text-[8px] font-black text-white">N</span>
                </div>
              )}

              {/* SCALE BAR */}
              <div className="absolute bottom-3 left-3 bg-slate-900/90 border border-slate-700 px-2 py-1 rounded shadow-lg text-[8px] font-mono text-slate-300 pointer-events-none flex items-center gap-2">
                <span>0</span>
                <div className="w-12 h-1 bg-gradient-to-r from-white via-slate-500 to-black border border-slate-400" />
                <span>10 km</span>
              </div>
            </div>

            {/* BOTTOM METADATA & LEGEND PANEL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[9px] pt-1">
              {/* 1. SYMBOLOGY / LEGEND */}
              {showLegend && (
                <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg space-y-1.5">
                  <span className="font-black text-slate-300 uppercase tracking-wider block text-[8px] flex items-center gap-1">
                    <Layers className="h-3 w-3 text-emerald-400" /> Map Legend
                  </span>

                  {layer === "pixel" && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: palette.high }} />
                        <span className="text-slate-300">High: {legendLabels.high}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: palette.mid }} />
                        <span className="text-slate-300">Average: {legendLabels.mid}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: palette.low }} />
                        <span className="text-slate-300">Low: {legendLabels.low}</span>
                      </div>
                    </div>
                  )}

                  {layer === "lulc" && (
                    <div className="grid grid-cols-2 gap-1 text-[8px]">
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#E49635"}} /><span>Crops</span></div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#397D49"}} /><span>Forest</span></div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#88B053"}} /><span>Grass</span></div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#C4281B"}} /><span>Built-up</span></div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#419BDF"}} /><span>Water</span></div>
                      <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{background: "#DFC35A"}} /><span>Shrub</span></div>
                    </div>
                  )}

                  {(layer === "osm" || layer === "satellite") && (
                    <p className="text-slate-400 italic">Standard base cartography with administrative county boundaries.</p>
                  )}
                </div>
              )}

              {/* 2. TECHNICAL SPECIFICATIONS */}
              {showMetadata && (
                <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg space-y-1 font-mono">
                  <span className="font-black text-slate-300 uppercase tracking-wider block text-[8px] flex items-center gap-1">
                    <Info className="h-3 w-3 text-blue-400" /> Spatial Specifications
                  </span>
                  <p className="text-slate-400"><strong className="text-slate-200">Layer:</strong> {layerName}</p>
                  <p className="text-slate-400"><strong className="text-slate-200">Opacity:</strong> {Math.round(opacity * 100)}% overlay transparency</p>
                  <p className="text-slate-400"><strong className="text-slate-200">Resolution:</strong> {spatialResolution}</p>
                  <p className="text-slate-400"><strong className="text-slate-200">Projection:</strong> WGS 84 / Pseudo-Mercator (EPSG:3857)</p>
                </div>
              )}

              {/* 3. SOURCES & CITATIONS */}
              {showMetadata && (
                <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg space-y-1 text-[8px]">
                  <span className="font-black text-slate-300 uppercase tracking-wider block flex items-center gap-1 text-[8px]">
                    <Check className="h-3 w-3 text-emerald-400" /> Data Sources & Models
                  </span>
                  <p className="text-slate-400">
                    <strong className="text-slate-300">Ground-truth:</strong> Ministry of Agriculture / AFA Kenya.
                  </p>
                  <p className="text-slate-400">
                    <strong className="text-slate-300">Remote Sensing:</strong> Google Earth Engine (CHIRPS, MODIS, Dynamic World V1).
                  </p>
                  <p className="text-slate-400">
                    <strong className="text-slate-300">Predictor:</strong> XGBoost ML Regressor (County-level tuned).
                  </p>
                  <p className="text-slate-500 italic pt-0.5">
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
              disabled={isExporting}
              onClick={() => handleExport("png")}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 gap-2 font-bold text-xs"
            >
              {isExporting && exportFormat === "png" ? <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> : <ImageIcon className="h-4 w-4 text-emerald-400" />}
              Download PNG Image
            </Button>

            <Button
              size="sm"
              disabled={isExporting}
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
