import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area
} from "recharts";
import { 
  Satellite, CloudRain, Thermometer, 
  Layers, Map as MapIcon, Loader2,
  FlaskConical, Droplets, Info
} from "lucide-react";
import { SoilMap } from "@/components/SoilMap";

interface PredictorDeepDiveProps {
  crop: string;
  year: number;
  county: string;
  subcounty: string;
  monthlyData: any[];
  mapPath?: string; 
  lulcMapPath?: string;
  soilData?: {
    ph: number;
    nitrogen: number;
    soc: number; 
    clay: number;
    sand: number;
    texture_class: string;
    advice: string;
  };
}

export const PredictorDeepDive = ({ 
  crop,        // ← FIX: was destructured before but missing — caused "undefined" crop labels
  year, 
  county, 
  subcounty,
  monthlyData = [], 
  soilData,
  lulcMapPath
}: PredictorDeepDiveProps) => {

  const [activeMapLayer, setActiveMapLayer] = useState<'osm' | 'satellite' | 'pixel' | 'lulc'>('osm');
  
  const hasMonthlyData = monthlyData && monthlyData.length > 0;
  const hasSoilData = !!soilData;

  const getAvg = (keys: string[]) => {
    if (!hasMonthlyData) return 0;
    const key = keys.find(k => monthlyData[0] && monthlyData[0][k] !== undefined) || keys[0];
    const vals = monthlyData.map(d => d[key]).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const totalRainfall = hasMonthlyData 
    ? monthlyData.reduce((acc, curr) => acc + (curr.chirps_rainfall || 0), 0)
    : 0;

  const summaryStats = [
    { 
        label: "Total Rainfall", 
        val: hasMonthlyData ? `${totalRainfall.toFixed(1)} mm` : "---", 
        desc: "Annual Cumulative", 
        icon: <CloudRain className="h-4 w-4" />, 
        color: "text-blue-600", bg: "bg-blue-50" 
    },
    { 
        label: "Soil Moisture", 
        val: hasMonthlyData ? `${getAvg(["soil_moisture"]).toFixed(1)}%` : "---", 
        desc: "Volumetric Content", 
        icon: <Droplets className="h-4 w-4" />, 
        color: "text-cyan-600", bg: "bg-cyan-50" 
    },
    { 
        label: "Avg Temp", 
        val: hasMonthlyData ? `${getAvg(["soil_temp", "temp"]).toFixed(1)}°C` : "---", 
        desc: "Seasonal Mean", 
        icon: <Thermometer className="h-4 w-4" />, 
        color: "text-orange-600", bg: "bg-orange-50" 
    },
    { 
        label: "pH Balance", 
        val: soilData?.ph ? soilData.ph.toFixed(1) : "---", 
        desc: "Acidity/Alkalinity", 
        icon: <FlaskConical className="h-4 w-4" />, 
        color: "text-indigo-600", bg: "bg-indigo-50" 
    },
  ];

  return (
    <div className="relative space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <Card className="border-slate-800 shadow-2xl bg-slate-900/80 backdrop-blur-md border-l-4 border-l-emerald-500 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200">
              <Satellite className="h-6 w-6" />
            </div>
            <div>
               <CardTitle className="text-2xl font-black text-slate-100 tracking-tight">GeoAI Predictors</CardTitle>
               <div className="flex items-center gap-2">
                 <Badge variant="outline" className="text-[10px] font-bold uppercase border-emerald-200 text-emerald-700">8-Band VRT Fusion</Badge>
                 {/* FIX: show the actual crop name, not undefined */}
                 <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">{crop} — {subcounty && subcounty !== "Select subcounty" ? subcounty : county}</p>
               </div>
            </div>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Season</p>
             <p className="text-2xl font-black text-emerald-600 leading-none">{year}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summaryStats.map((stat, i) => (
              <div key={i} className={`${stat.bg} rounded-2xl p-4 transition-transform hover:scale-[1.02]`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                  <div className={stat.color}>{stat.icon}</div>
                </div>
                <div className={`text-xl font-black ${stat.color}`}>{stat.val}</div>
                <p className="text-[10px] text-slate-400 font-bold mt-1 opacity-70">{stat.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 shadow-2xl border-slate-800 bg-slate-900 rounded-[2rem]">
            <h4 className="text-sm font-black text-slate-100 uppercase tracking-widest flex items-center gap-2 mb-8">
              <CloudRain className="h-4 w-4 text-blue-500" /> Precipitation Flux (CHIRPS)
            </h4>
            <div className="h-72">
              {hasMonthlyData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#cbd5e1', fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{fill: '#cbd5e1', fontWeight: 'bold'}} />
                    <Tooltip cursor={{stroke: '#3b82f6', strokeWidth: 2}} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} />
                    <Area type="monotone" dataKey="chirps_rainfall" name="Rainfall (mm)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRain)" strokeWidth={4} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col h-full items-center justify-center gap-4 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Syncing Rainfall Data...</p>
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 shadow-xl border-none bg-slate-900 text-white rounded-[2rem]">
              <h4 className="text-[10px] font-black text-emerald-400 uppercase mb-6 flex items-center gap-2">
                <Thermometer className="h-4 w-4" /> Soil Temperature (°C)
              </h4>
              <div className="h-40">
                {hasMonthlyData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid stroke="#1e293b" vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={9} tick={{fill: '#475569'}} />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '10px'}} />
                      <Line type="monotone" dataKey="soil_temp" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981'}} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-slate-600 text-[10px] font-bold uppercase tracking-widest">AWAITING SENSOR DATA</div>}
              </div>
            </Card>

            <Card className="p-6 shadow-2xl border-slate-800 bg-slate-900/50 rounded-[2rem]">
              <h4 className="text-[10px] font-black text-blue-500 uppercase mb-6 flex items-center gap-2">
                <Droplets className="h-4 w-4" /> Soil Moisture (%)
              </h4>
              <div className="h-40">
                {hasMonthlyData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData}>
                      <CartesianGrid stroke="#1e293b" vertical={false} strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="soil_moisture" stroke="#3b82f6" fill="#1e3a8a" strokeWidth={3} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={9} tick={{fill: '#64748b'}} />
                      <Tooltip contentStyle={{borderRadius: '10px', border: 'none'}} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">LOADING MOISTURE DATA...</div>}
              </div>
            </Card>
          </div>
        </div>

        {/* RIGHT: Interactive Map + Soil Stats */}
        <div className="lg:col-span-1 space-y-4">

          {/* FIX: Interactive Leaflet map for soil */}
          <div className="w-full">
            <SoilMap
              county={county}
              subcounty={subcounty === "Select subcounty" ? "" : subcounty}
            />
          </div>

          {/* Soil composition stats */}
          <Card className="border-none shadow-2xl overflow-hidden bg-slate-950 text-white rounded-[2rem]">
            <CardContent className="pt-5 space-y-5">

              <p className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest flex items-center gap-2">
                <Info className="h-3 w-3" /> Soil Composition — {subcounty && subcounty !== "Select subcounty" ? subcounty : county}
              </p>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>Clay Content</span>
                    <span className="text-red-400">{soilData?.clay || 0}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 transition-all duration-1000" style={{width: `${soilData?.clay || 0}%`}} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span>Org. Carbon (SOC)</span>
                    <span className="text-blue-400">{soilData?.soc || 0} g/kg</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{width: `${Math.min((soilData?.soc || 0) * 2, 100)}%`}} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {label: "pH Balance", val: soilData?.ph ? soilData.ph.toFixed(1) : "---", sub: "Soil Acidity", color: "text-indigo-400"},
                  {label: "Nitrogen", val: soilData?.nitrogen ? `${soilData.nitrogen.toFixed(2)}` : "---", sub: "g/kg Total N", color: "text-emerald-400"},
                  {label: "Texture", val: soilData?.texture_class || "---", sub: "USDA Class", color: "text-purple-400"},
                  {label: "Clay Content", val: soilData?.clay ? `${soilData.clay}%` : "---", sub: "Particle Size", color: "text-red-400"}
                ].map(item => (
                  <div key={item.label} className="bg-slate-900 rounded-xl p-3">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">{item.label}</p>
                    <p className={`text-lg font-black tracking-tighter ${item.color}`}>{item.val}</p>
                    <p className="text-[9px] font-bold text-slate-600 uppercase">{item.sub}</p>
                  </div>
                ))}
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                <p className="text-[10px] font-black text-emerald-500 uppercase mb-1 tracking-wider">
                  <MapIcon className="h-3 w-3 inline mr-1" />Agronomic Advice — {crop}
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed italic font-medium">
                  "{soilData?.advice || "Analyzing spatial constraints for optimized yield..."}"
                </p>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PredictorDeepDive;