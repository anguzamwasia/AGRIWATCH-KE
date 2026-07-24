import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../config";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, AlertTriangle, Loader2, MapPin, Activity } from "lucide-react";

interface PhenologyProps {
  selectedCounty: string;
  selectedSubcounty: string;
  selectedYear: string | number;
}

const PhenologyAnalysis = ({ selectedCounty, selectedSubcounty, selectedYear }: PhenologyProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Handle "Entire Country" logic to send correct query to backend
        const subValue = selectedSubcounty === "Entire Country" || selectedSubcounty === "Select subcounty" 
          ? "" 
          : selectedSubcounty;

        const response = await fetch(
          `${API_BASE_URL}/api/analytics/phenology?county=${encodeURIComponent(selectedCounty)}&subcounty=${encodeURIComponent(subValue)}&year=${selectedYear}`
        );
        const result = await response.json();
        if (result && result.metrics) {
          setData(result);
        }
      } catch (err) {
        console.error("Phenology data fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    if (selectedCounty && selectedCounty !== "Select county") {
      fetchData();
    }
  }, [selectedCounty, selectedSubcounty, selectedYear]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center bg-slate-900 rounded-2xl border border-slate-800">
        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-2" />
        <p className="text-slate-400 text-sm">Retrieving Satellite Trajectory...</p>
      </div>
    );
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="p-10 text-center text-slate-400 border border-dashed border-slate-700 rounded-2xl bg-slate-900/50">
        <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p>Select a region to view raw phenology data.</p>
        <p className="text-xs opacity-50">Ensure backend phenology_service is active.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-2xl overflow-hidden bg-slate-950 text-white">
        <CardHeader className="bg-slate-900/80 border-b border-slate-800 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <MapPin className="text-emerald-400 h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">
                  {selectedSubcounty !== "Entire Country" ? selectedSubcounty : selectedCounty}
                </CardTitle>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                  Raw NDVI Trajectory • {selectedYear}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1">
                {data.metrics.current_status}
              </Badge>
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-3 py-1">
                Peak: {data.metrics.pos}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Main Chart Area */}
          <div className="h-[350px] w-full mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNdvi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="display_date" 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  domain={[0, 1]} 
                  ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area 
                  name="NDVI"
                  type="monotone" 
                  dataKey="ndvi" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorNdvi)" 
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 1, stroke: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Analysis Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800 hover:border-emerald-500/30 transition-colors">
              <h4 className="flex items-center gap-2 text-sm font-bold text-emerald-400 mb-3">
                <Lightbulb className="h-4 w-4" /> Regional Context
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed">
                {data.insights.description}
              </p>
            </div>

            <div className="p-5 bg-slate-900/50 rounded-2xl border border-slate-800 hover:border-amber-500/30 transition-colors">
              <h4 className="flex items-center gap-2 text-sm font-bold text-amber-400 mb-3">
                <AlertTriangle className="h-4 w-4" /> Management Advisory
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.insights.interventions.length > 0 ? (
                  data.insights.interventions.map((txt: string, i: number) => (
                    <Badge key={i} variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 text-[11px] font-medium">
                      {txt}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic">No specific interventions required for this profile.</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PhenologyAnalysis;