import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, MapPin, Droplets, Thermometer, 
  AlertTriangle, CheckCircle2, Lightbulb, Printer, Download,
  Activity, Sprout, History
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
    if (val >= 4) return { status: 'Excellent', color: 'green', icon: CheckCircle2 };
    if (val >= 2.5) return { status: 'Average', color: 'yellow', icon: AlertTriangle };
    return { status: 'Stressed', color: 'red', icon: AlertTriangle };
  };

  const yieldStatus = getYieldStatus(predicted);
  const StatusIcon = yieldStatus.icon;

  // Include the requested year in the trends table if it's a future prediction
  const maxYear = Math.max(2025, year);
  const reportTrends = trendData.filter(d => d.year >= 2017 && d.year <= maxYear);

  const getOverviewText = () => {
    const loc = (subcounty && subcounty !== "Select subcounty") 
      ? `${subcounty}, ${county}` 
      : (county === "Kenya" ? "Kenya" : `${county} County`);
    const isPred = year > 2025;
    const yearText = isPred ? `For the projected year ${year}` : `For the historical year ${year}`;
    const actionText = isPred ? 'is forecasted to stand at' : 'stood at';
    const yieldText = isPred ? 'is predicting' : 'recorded';
    
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

    let zoneDesc = "a medium-potential agricultural zone supporting mixed crop-livestock farming";
    if (county === "Kenya") {
      zoneDesc = "the national agricultural baseline, with agriculture contributing approximately 33% of Kenya's GDP";
    } else if (highPotentialCounties.includes(county)) {
      zoneDesc = "a high-potential agricultural highland zone characterized by fertile soils and favorable rainfall";
    } else if (asalCounties.includes(county)) {
      zoneDesc = "a semi-arid or marginal agricultural zone (ASAL) vulnerable to seasonal rainfall variability";
    }
    
    return `${loc} serves as ${zoneDesc}. ${yearText}, the total cultivation area for ${crop} ${actionText} ${area > 0 ? Math.round(area).toLocaleString() : '0'} hectares. Based on the geographic and climatic profile, the system ${yieldText} an average crop yield of ${predicted > 0 ? predicted.toFixed(2) : '0.00'} tonnes per hectare, resulting in a cumulative production volume of ${production > 0 ? (production/1000).toFixed(1) : '0.0'} thousand metric tonnes. Local environmental conditions reflect an annual rainfall aggregation of ${rainfall > 0 ? Math.round(rainfall) : '0'} mm and an average temperature of ${temperature > 0 ? temperature.toFixed(1) : '0.0'}°C.`;
  };

  return (
    <Card className="shadow-none border-none bg-transparent">
      <CardContent className="p-0 space-y-8">
        
        {/* Header Action */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">Official Yield Report</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="bg-slate-900/50 border-slate-700 text-slate-300">
                <MapPin className="h-3 w-3 mr-1 text-emerald-500" />
                {county}{subcounty && ` - ${subcounty}`}
              </Badge>
              <Badge variant="outline" className="bg-slate-900/50 border-slate-700 text-slate-300">
                <Calendar className="h-3 w-3 mr-1 text-emerald-500" />
                {year}
              </Badge>
              <Badge variant="outline" className="bg-slate-900/50 border-slate-700 text-slate-300">
                <Sprout className="h-3 w-3 mr-1 text-emerald-500" />
                {crop}
              </Badge>
            </div>
          </div>
          <Button 
            onClick={onDownload} 
            disabled={isGenerating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 px-6 h-12 rounded-xl shadow-[0_0_20px_rgba(5,150,105,0.4)] transition-all"
          >
            {isGenerating ? <Activity className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            {isGenerating ? "Compiling PDF..." : "Download PDF Report"}
          </Button>


        </div>

        <div id="pdf-content" className="space-y-8 bg-[#020617] p-2 md:p-6 rounded-2xl">
          {/* 1. OVERVIEW */}
          <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" /> Geographic & Yield Overview
          </h3>
          <div className="p-5 bg-slate-800/40 border border-slate-700/50 rounded-2xl">
            <p className="text-slate-300 leading-relaxed text-sm md:text-base">
              {getOverviewText()}
            </p>
          </div>
        </div>

        {/* 2. YIELD OUTLOOK */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" /> Executive Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 bg-emerald-950/40 border border-emerald-900/50 rounded-2xl relative overflow-hidden">
              {year > 2025 && <div className="absolute top-0 right-0 bg-purple-600/80 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">PREDICTED</div>}
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Average Yield</p>
              <div className="flex items-end gap-2">
                <h4 className="text-4xl font-black text-white">{predicted > 0 ? predicted.toFixed(2) : "0.00"}</h4>
                <span className="text-sm text-emerald-500 font-bold mb-1">t/ha</span>
              </div>
            </div>
            <div className="p-6 bg-blue-950/40 border border-blue-900/50 rounded-2xl relative overflow-hidden">
              {year > 2025 && <div className="absolute top-0 right-0 bg-purple-600/80 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">PREDICTED</div>}
              <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">Total Production</p>
              <div className="flex items-end gap-2">
                <h4 className="text-4xl font-black text-white">{production > 0 ? (production/1000).toFixed(1) : "0.0"}</h4>
                <span className="text-sm text-blue-500 font-bold mb-1">k Tons</span>
              </div>
            </div>
            <div className="p-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl relative overflow-hidden">
              {year > 2025 && <div className="absolute top-0 right-0 bg-purple-600/80 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">PREDICTED</div>}
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Area Cultivated</p>
              <div className="flex items-end gap-2">
                <h4 className="text-4xl font-black text-white">{area > 0 ? Math.round(area).toLocaleString() : "0"}</h4>
                <span className="text-sm text-slate-500 font-bold mb-1">Ha</span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="border-slate-800" />

        {/* 2. ENVIRONMENTAL & SOIL PREDICTORS */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Droplets className="h-4 w-4 text-blue-500" /> Environmental Predictors
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-5 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="h-12 w-12 rounded-full bg-blue-900/30 flex items-center justify-center border border-blue-800/50">
                <Droplets className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Annual Rainfall</p>
                <p className="text-2xl font-black text-white">{rainfall > 0 ? `${Math.round(rainfall)} mm` : "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="h-12 w-12 rounded-full bg-orange-900/30 flex items-center justify-center border border-orange-800/50">
                <Thermometer className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Temperature</p>
                <p className="text-2xl font-black text-white">{temperature > 0 ? `${temperature.toFixed(1)} °C` : "N/A"}</p>
              </div>
            </div>
          </div>
          {predictorData?.soilData && (
            <div className="p-5 bg-slate-900/30 border border-slate-800 rounded-2xl mt-2 flex flex-col gap-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Soil pH</p>
                  <p className="text-lg font-black text-slate-200">{predictorData.soilData.ph || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Organic Carbon</p>
                  <p className="text-lg font-black text-slate-200">{predictorData.soilData.soc ? `${predictorData.soilData.soc} g/kg` : "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Texture Class</p>
                  <p className="text-lg font-black text-slate-200">{predictorData.soilData.texture_class || "N/A"}</p>
                </div>
              </div>
              {predictorData.soilData.advice && (
                <div className="mt-2 text-sm text-slate-300 leading-relaxed border-l-2 border-emerald-500 pl-4 py-1">
                  <strong>Soil & Agronomy Advisory:</strong> {predictorData.soilData.advice}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. PHENOLOGY & GROWTH STAGES */}
        {phenologyData?.metrics && (
          <>
            <Separator className="border-slate-800" />
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Sprout className="h-4 w-4 text-green-500" /> Crop Phenology & Growth Milestones
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Current Status</p>
                  <p className="text-lg font-black text-emerald-400 mt-1">{phenologyData.metrics.current_status || "Active Development"}</p>
                </div>
                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Peak Growth</p>
                  <p className="text-lg font-black text-emerald-400 mt-1">{phenologyData.metrics.pos || phenologyData.metrics.peak_date || "N/A"}</p>
                </div>
              </div>
              
              {phenologyData.data && phenologyData.data.length > 0 && (
                <div className="h-[200px] w-full mt-4 bg-slate-900/30 rounded-2xl p-4 border border-slate-800/50">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={phenologyData.data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorNdviReport" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis 
                        dataKey="display_date" 
                        stroke="#64748b" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        minTickGap={30}
                      />
                      <YAxis 
                        stroke="#64748b" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        domain={[0, 1]} 
                        ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="ndvi" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorNdviReport)" 
                        dot={{ r: 2, fill: '#10b981', strokeWidth: 1, stroke: '#fff' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="p-5 bg-slate-800/40 border border-slate-700/50 rounded-2xl mt-4">
                <p className="text-slate-300 leading-relaxed text-sm">
                  <strong>Phenology Analysis:</strong> The crop phenology tracks the structural development of the {crop} from planting to physiological maturity. 
                  The peak growth marker ({phenologyData.metrics.pos || phenologyData.metrics.peak_date || "N/A"}) signifies the maximum vegetative phase. 
                  These temporal milestones are directly correlated to the final predictive yield model.
                </p>
              </div>
            </div>
          </>
        )}

        <Separator className="border-slate-800" />

        {/* 4. HISTORICAL TRENDS TABLE */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <History className="h-4 w-4 text-purple-500" /> Yield Trajectory (2017-{maxYear})
          </h3>
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
            <Table>
              <TableHeader className="bg-slate-900/80">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-bold uppercase text-xs">Year</TableHead>
                  <TableHead className="text-slate-400 font-bold uppercase text-xs text-right">Area (Ha)</TableHead>
                  <TableHead className="text-slate-400 font-bold uppercase text-xs text-right">Production (MT)</TableHead>
                  <TableHead className="text-slate-400 font-bold uppercase text-xs text-right">Yield (t/ha)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportTrends.length > 0 ? reportTrends.map((row, i) => (
                  <TableRow key={i} className="border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <TableCell className="font-bold text-slate-300">
                      {row.year} 
                      {row.year > 2025 && <Badge variant="outline" className="ml-2 bg-purple-900/30 text-purple-400 border-purple-800 text-[10px]">Predicted</Badge>}
                    </TableCell>
                    <TableCell className="text-right text-slate-400 font-medium">{Math.round(row.area_ha).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-slate-400 font-medium">{Math.round(row.production_tons).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-black text-emerald-400">{row.yield_tha?.toFixed(2)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-slate-500 font-medium">No official or predicted data recorded for this selection.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-8 pt-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
              Yield Trajectory (t/ha)
              {maxYear > 2025 && <span className="text-[10px] text-purple-400">* Labeled points represent AI predictions</span>}
            </h4>
            <div className="h-64 w-full bg-slate-900/30 rounded-xl p-4 border border-slate-800/50">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reportTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="year" 
                    stroke="#94a3b8" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(tick) => tick > 2025 ? `${tick}*` : tick}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                  />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="yield_tha" 
                    name="Yield (t/ha)"
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#34d399' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
      </CardContent>
    </Card>
  );
};