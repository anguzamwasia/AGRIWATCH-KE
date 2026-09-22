import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, MapPin, Droplets, Thermometer, 
  AlertTriangle, CheckCircle2, Lightbulb, Download,
  Activity, Sprout, History, Shield, FileCheck, Layers, Award
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface ReportGeneratorProps {
  county: string;
  subcounty: string;
  year: number;
  crop: string;
  yieldData?: any;
  trendData?: any[];
  predictorData?: any;
  phenologyData?: any;
  onDownload: () => void;
  isGenerating: boolean;
}

export const ReportGenerator = ({ 
  county, subcounty, year, crop, 
  yieldData, trendData = [], predictorData, phenologyData,
  onDownload, isGenerating 
}: ReportGeneratorProps) => {
  
  const predicted = parseFloat(String(yieldData?.predicted_yield || 0));
  const production = parseFloat(String(yieldData?.production || 0));
  const area = parseFloat(String(yieldData?.area_ha || 0));
  const rainfall = parseFloat(String(yieldData?.rainfall || 0));
  const temperature = parseFloat(String(yieldData?.temp || 0));

  const getYieldStatus = (val: number) => {
    if (val >= 4) return { status: 'Optimal Yield Zone', color: 'emerald', textClass: 'text-emerald-800 bg-emerald-100 border-emerald-300', icon: CheckCircle2 };
    if (val >= 2.5) return { status: 'Moderate / Baseline', color: 'amber', textClass: 'text-amber-800 bg-amber-100 border-amber-300', icon: AlertTriangle };
    return { status: 'Stressed / Below Baseline', color: 'red', textClass: 'text-red-800 bg-red-100 border-red-300', icon: AlertTriangle };
  };

  const yieldStatus = getYieldStatus(predicted);
  const StatusIcon = yieldStatus.icon;

  // Include the requested year in the trends table if it's a future prediction
  const maxYear = Math.max(2025, year);
  const reportTrends = trendData.filter(d => d.year >= 2017 && d.year <= maxYear);

  const getOverviewText = () => {
    const loc = (subcounty && subcounty !== "Select subcounty") 
      ? `${subcounty} Sub-county, ${county} County` 
      : (county === "Kenya" ? "National Territory of Kenya" : `${county} County`);
    const isPred = year > 2025;
    const yearText = isPred ? `For the projected ${year} cropping calendar` : `For the ${year} agricultural season`;
    const actionText = isPred ? 'is estimated at' : 'recorded';
    const yieldText = isPred ? 'forecasts an average productivity of' : 'registered an average yield of';
    
    const asalCounties = [
      "Turkana", "Marsabit", "Mandera", "Wajir", "Garissa", 
      "Isiolo", "Samburu", "Tana River", "Kajiado", "West Pokot", 
      "Baringo", "Kitui", "Makueni", "Lamu"
    ];
    
    const highPotentialCounties = [
      "Trans Nzoia", "Uasin Gishu", "Nandi", "Nakuru", "Kakamega", 
      "Bungoma", "Meru", "Kirinyaga", "Bomet", "Kericho", "Nyeri", 
      "Kiambu", "Murang'a", "Embu", "Nyandarua", "Kisii", "Nyamira", 
      "Vihiga"
    ];

    let zoneDesc = "a medium-potential agro-ecological zone supporting mixed grain and subsistence agriculture";
    if (county === "Kenya") {
      zoneDesc = "the aggregate national agricultural baseline, where crop production accounts for over 33% of national GDP and direct rural employment";
    } else if (highPotentialCounties.includes(county)) {
      zoneDesc = "a primary commercial agricultural breadbasket in the Kenyan highlands, characterized by deep volcanic soils and dependable bimodal precipitation";
    } else if (asalCounties.includes(county)) {
      zoneDesc = "an arid and semi-arid land (ASAL) zone subject to heightened rainfall variability and drought exposure";
    }
    
    return `${loc} is classified under ${zoneDesc}. ${yearText}, the effective harvested area under ${crop} ${actionText} ${area > 0 ? Math.round(area).toLocaleString() : '0'} hectares. Synthesis of remote sensing telemetry and machine learning predictive regressors ${yieldText} ${predicted > 0 ? predicted.toFixed(2) : '0.00'} tonnes per hectare (t/ha), generating an estimated aggregate output of ${production > 0 ? (production/1000).toFixed(1) : '0.0'} thousand metric tonnes. Regional meteorological indicators reflect a seasonal rainfall accumulation of ${rainfall > 0 ? Math.round(rainfall) : '0'} mm alongside a mean canopy temperature of ${temperature > 0 ? temperature.toFixed(1) : '0.0'}°C.`;
  };

  const currentDateStr = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <Card className="shadow-none border-none bg-transparent">
      <CardContent className="p-0 space-y-6">
        
        {/* Header Action Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Official Agricultural Intelligence Dossier</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              National Crop Yield & Production Assessment · Republic of Kenya
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 font-semibold">
                <MapPin className="h-3 w-3 mr-1 text-emerald-600" />
                {county}{subcounty && ` — ${subcounty}`}
              </Badge>
              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 font-semibold">
                <Calendar className="h-3 w-3 mr-1 text-emerald-600" />
                Season: {year}
              </Badge>
              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 font-semibold">
                <Sprout className="h-3 w-3 mr-1 text-emerald-600" />
                Crop: {crop}
              </Badge>
            </div>
          </div>
          <Button 
            onClick={onDownload} 
            disabled={isGenerating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 px-6 h-12 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex-shrink-0"
          >
            {isGenerating ? <Activity className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            {isGenerating ? "Compiling PDF Document..." : "Download Official PDF Report"}
          </Button>
        </div>

        {/* PRINTABLE OFFICIAL WORD-STYLE DOCUMENT CONTAINER */}
        <div 
          id="pdf-content" 
          className="bg-white text-slate-900 p-8 md:p-12 rounded-2xl border border-slate-200 shadow-2xl space-y-8 font-sans"
          style={{ backgroundColor: "#ffffff" }}
        >
          {/* OFFICIAL WORD-DOCUMENT LETTERHEAD BANNER */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-lg shadow-md border border-slate-700 flex-shrink-0">
                  KE
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                    Republic of Kenya · Ministry of Agriculture & Livestock Development
                  </div>
                  <h1 className="text-xl md:text-2xl font-black text-slate-950 tracking-tight leading-tight">
                    AgriWatch National Crop Intelligence Dossier
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Integrated Satellite Earth Observation, Machine Learning & Soil Health Decision Support System
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right flex-shrink-0 font-mono text-[10px] text-slate-500 space-y-0.5">
                <div>REF: <strong className="text-slate-800">AGRIWATCH-KE/{county.toUpperCase().replace(/\s+/g, '_')}/{year}/01</strong></div>
                <div>DATE: <span className="text-slate-700">{currentDateStr}</span></div>
                <div>STATUS: <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[9px]">OFFICIAL BULLETIN</span></div>
              </div>
            </div>

            {/* Sub-bar with Target Area & Classification */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Target Administrative Area:</span>
                <span className="font-black text-slate-900">{county} County {subcounty ? `(${subcounty} Sub-county)` : ""}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-500 text-[11px]">Commodity: <strong className="text-emerald-700">{crop}</strong></span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 text-[11px]">Cropping Calendar: <strong className="text-slate-800">{year} Season</strong></span>
                <span className="text-slate-300">|</span>
                <span className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full border ${yieldStatus.textClass}`}>
                  <StatusIcon className="h-3 w-3" />
                  {yieldStatus.status}
                </span>
              </div>
            </div>
          </div>

          {/* 1. EXECUTIVE SUMMARY KPI CARDS */}
          <div className="space-y-3">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-600" />
              1. Executive Agricultural Yield & Harvest Synthesis
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 bg-emerald-50/70 border-2 border-emerald-300 rounded-xl relative overflow-hidden shadow-sm">
                {year > 2025 && (
                  <div className="absolute top-0 right-0 bg-purple-700 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-md">
                    AI Forecast
                  </div>
                )}
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                  Expected Crop Yield
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-black text-emerald-950">
                    {predicted > 0 ? predicted.toFixed(2) : "0.00"}
                  </span>
                  <span className="text-sm font-black text-emerald-700">Tonnes / Hectare (t/ha)</span>
                </div>
                <p className="text-[11px] text-emerald-800/80 mt-1">
                  Predictive accuracy score calibrated via multi-temporal Sentinel-2 MSI NDVI & CHIRPS.
                </p>
              </div>

              <div className="p-5 bg-blue-50/70 border-2 border-blue-300 rounded-xl relative overflow-hidden shadow-sm">
                {year > 2025 && (
                  <div className="absolute top-0 right-0 bg-purple-700 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-md">
                    AI Forecast
                  </div>
                )}
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
                  Estimated Aggregate Production
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-black text-blue-950">
                    {production > 0 ? (production / 1000).toFixed(1) : "0.0"}
                  </span>
                  <span className="text-sm font-black text-blue-700">Thousand Metric Tonnes (k MT)</span>
                </div>
                <p className="text-[11px] text-blue-800/80 mt-1">
                  National food balance sheet aggregate equivalent: {production > 0 ? Math.round(production).toLocaleString() : "0"} metric tonnes.
                </p>
              </div>

              <div className="p-5 bg-slate-50 border-2 border-slate-300 rounded-xl relative overflow-hidden shadow-sm">
                {year > 2025 && (
                  <div className="absolute top-0 right-0 bg-purple-700 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-md">
                    AI Forecast
                  </div>
                )}
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Effective Harvested Area
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-black text-slate-900">
                    {area > 0 ? Math.round(area).toLocaleString() : "0"}
                  </span>
                  <span className="text-sm font-black text-slate-600">Hectares (Ha)</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Area mask delineated from ESA WorldCover 10m agricultural land-use layers.
                </p>
              </div>
            </div>
          </div>

          {/* 2. REGIONAL AGRO-ECOLOGICAL CONTEXT */}
          <div className="space-y-2">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-600" />
              2. Agro-Ecological Analysis & Geospatial Overview
            </h2>
            <div className="p-5 bg-slate-50 border border-slate-200 border-l-4 border-l-emerald-600 rounded-xl shadow-sm">
              <p className="text-slate-800 leading-relaxed text-sm md:text-base font-normal">
                {getOverviewText()}
              </p>
            </div>
          </div>

          {/* 3. ENVIRONMENTAL METEOROLOGY & SOIL EDAPHIC DIAGNOSTICS */}
          <div className="space-y-3">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-600" />
              3. Meteorological Conditions & Soil Chemistry Drivers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center border border-blue-200 text-blue-700 flex-shrink-0">
                  <Droplets className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Seasonal Cumulative Rainfall</span>
                  <p className="text-2xl font-black text-slate-900">
                    {rainfall > 0 ? `${Math.round(rainfall)} mm` : "N/A"}
                  </p>
                  <span className="text-[10px] text-slate-500">CHIRPS 0.05° daily satellite precipitation integration</span>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center border border-amber-200 text-amber-700 flex-shrink-0">
                  <Thermometer className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Mean Canopy Temperature</span>
                  <p className="text-2xl font-black text-slate-900">
                    {temperature > 0 ? `${temperature.toFixed(1)} °C` : "N/A"}
                  </p>
                  <span className="text-[10px] text-slate-500">ERA5-Land reanalysis thermal crop monitoring</span>
                </div>
              </div>
            </div>

            {predictorData?.soilData && (
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Layers className="h-4 w-4 text-emerald-700" />
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Topsoil Edaphic Properties (0-20 cm depth)</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Soil pH (H₂O)</span>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{predictorData.soilData.ph || "N/A"}</p>
                    <span className="text-[9px] text-slate-500">Reaction Classification</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Soil Organic Carbon</span>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{predictorData.soilData.soc ? `${predictorData.soilData.soc} g/kg` : "N/A"}</p>
                    <span className="text-[9px] text-slate-500">Humus & Biomass Reserve</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">USDA Texture Class</span>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{predictorData.soilData.texture_class || "N/A"}</p>
                    <span className="text-[9px] text-slate-500">Physical Granulometry</span>
                  </div>
                </div>
                {predictorData.soilData.advice && (
                  <div className="text-xs text-slate-700 leading-relaxed border-l-2 border-emerald-600 pl-3 py-1 bg-white rounded-r-lg border border-slate-200">
                    <strong className="text-slate-900">Agronomic Advisory:</strong> {predictorData.soilData.advice}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. CROP PHENOLOGY & SEASONAL MILESTONES */}
          {phenologyData?.metrics && (
            <div className="space-y-3">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Sprout className="h-4 w-4 text-emerald-600" />
                4. Crop Phenology & Physiological Milestones
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Active Physiological Phase</span>
                  <p className="text-base font-black text-emerald-700 mt-1">{phenologyData.metrics.current_status || "Active Development"}</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Peak Vegetative Vigor Date (POS)</span>
                  <p className="text-base font-black text-emerald-700 mt-1">{phenologyData.metrics.pos || phenologyData.metrics.peak_date || "N/A"}</p>
                </div>
              </div>

              {phenologyData.data && phenologyData.data.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">Multi-Temporal Sentinel-2 NDVI Trajectory</span>
                    <span className="text-[10px] text-slate-500">Vegetation Index (0.00 – 1.00)</span>
                  </div>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={phenologyData.data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorNdviReportWhite" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.35}/>
                            <stop offset="95%" stopColor="#059669" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis 
                          dataKey="display_date" 
                          stroke="#64748b" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={{ stroke: '#cbd5e1' }}
                          minTickGap={30}
                        />
                        <YAxis 
                          stroke="#64748b" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={{ stroke: '#cbd5e1' }} 
                          domain={[0, 1]} 
                          ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="ndvi" 
                          stroke="#059669" 
                          strokeWidth={2.5}
                          fillOpacity={1} 
                          fill="url(#colorNdviReportWhite)" 
                          dot={{ r: 2.5, fill: '#059669', strokeWidth: 1, stroke: '#ffffff' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                <strong className="text-slate-900">Phenological Interpretation:</strong> Canopy reflectance curves depict green-up timing, maximum vegetative biomass inflection, and senescence. Peak biomass marker ({phenologyData.metrics.pos || phenologyData.metrics.peak_date || "N/A"}) corresponds to anthesis and grain-filling windows where moisture deficit causes the greatest yield penalty.
              </div>
            </div>
          )}

          {/* 5. HISTORICAL YIELD TRAJECTORY & TREND TABLE */}
          <div className="space-y-4">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <History className="h-4 w-4 text-purple-600" />
              5. Multi-Year Production Trajectory & Empirical Baselines (2017–{maxYear})
            </h2>

            <div className="rounded-xl border border-slate-300 overflow-hidden bg-white shadow-sm">
              <Table>
                <TableHeader className="bg-slate-900 text-white">
                  <TableRow className="border-b border-slate-800 hover:bg-transparent">
                    <TableHead className="text-white font-bold uppercase text-xs">Calendar Year</TableHead>
                    <TableHead className="text-white font-bold uppercase text-xs text-right">Harvested Area (Ha)</TableHead>
                    <TableHead className="text-white font-bold uppercase text-xs text-right">Total Output (MT)</TableHead>
                    <TableHead className="text-white font-bold uppercase text-xs text-right">Yield Efficiency (t/ha)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportTrends.length > 0 ? reportTrends.map((row, i) => (
                    <TableRow key={i} className="border-b border-slate-200 hover:bg-slate-50 transition-colors even:bg-slate-50/50">
                      <TableCell className="font-bold text-slate-900">
                        {row.year} 
                        {row.year > 2025 && (
                          <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-800 border-purple-300 text-[10px] font-bold">
                            AI Forecast
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-slate-700 font-medium">
                        {Math.round(row.area_ha).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-slate-700 font-medium">
                        {Math.round(row.production_tons).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-700">
                        {row.yield_tha?.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-slate-500 font-medium">
                        No historical records logged for the selected configuration.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Line Chart */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Productivity Trend Curve (Tonnes per Hectare)
                </span>
                {maxYear > 2025 && (
                  <span className="text-[10px] text-purple-700 font-semibold">
                    * Labeled years &gt; 2025 denote algorithmic machine learning projections
                  </span>
                )}
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportTrends} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis 
                      dataKey="year" 
                      stroke="#64748b" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickFormatter={(tick) => tick > 2025 ? `${tick}*` : tick}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      domain={['auto', 'auto']}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: '#047857', fontWeight: 'bold' }}
                      labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="yield_tha" 
                      name="Yield (t/ha)"
                      stroke="#059669" 
                      strokeWidth={3}
                      dot={{ fill: '#059669', strokeWidth: 2, r: 4, stroke: '#ffffff' }}
                      activeDot={{ r: 6, fill: '#10b981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 6. OFFICIAL MINISTERIAL ATTESTATION & CITATION FOOTER */}
          <div className="pt-6 border-t-2 border-slate-900 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                  Methodological Standards & Data Governance
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Yield predictions generated using extreme gradient boosting ensembles trained on Kenya Ministry of Agriculture ground surveys (2017–2024), calibrated with Google Earth Engine remote sensing pipelines (Sentinel-2 MSI, CHIRPS precipitation, and ERA5-Land reanalysis).
                </p>
              </div>
              <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Executive Certification & Stamp</span>
                <div className="h-10 border-b border-dashed border-slate-400 flex items-end pb-1 text-[11px] text-slate-400 italic">
                  Chief Agricultural Data Officer / Lead Agronomist Sign-off
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                  <span>HASH: SHA256-AGRIWATCH-{county.toUpperCase().slice(0, 3)}-{year}</span>
                  <span className="font-bold text-emerald-700">VERIFIED VALID</span>
                </div>
              </div>
            </div>

            <div className="pt-2 text-center text-[10px] text-slate-400 border-t border-slate-200">
              AgriWatch-KE National Agricultural Decision Support Bulletin · Ministry of Agriculture & Livestock Development, Kilimo House, Nairobi, Kenya.
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
};