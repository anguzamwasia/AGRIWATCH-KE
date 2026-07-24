import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { TrendingUp, Cloud } from "lucide-react";

/**
 * Interface for the data points expected in the graphData array.
 */
interface TrendDataPoint {
  year: number;
  yield_tha: number;
  production_tons: number;
  area_ha: number;
  is_predicted: boolean;
}

interface PredictorChartsProps {
  county: string;
  year: number;
  crop: string;
  graphData: TrendDataPoint[]; 
}

/**
 * Main Chart Component
 * Visualizes historical productivity vs projected efficiency.
 * Only renders the chart to avoid duplicating the metric cards.
 */
export const PredictorCharts = ({ county, year, crop, graphData }: PredictorChartsProps) => {
  
  // 1. Loading/Empty State
  if (!graphData || graphData.length === 0) {
    return (
      <div className="h-96 flex flex-col items-center justify-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
        <Cloud className="h-12 w-12 text-slate-300 mb-4 animate-bounce" />
        <p className="text-slate-500 font-semibold text-lg">Initializing Historical Context...</p>
        <p className="text-sm text-slate-400">Fetching records for {county} {crop}</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card className="shadow-xl border-none bg-white rounded-[2rem] overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="font-black text-slate-800 tracking-tight">Yield Performance Trend</span>
            </div>
            <div className="flex gap-2">
               <Badge variant="outline" className="border-slate-200 text-slate-500 font-bold px-3 py-1">
                 {county} • {crop}
               </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={graphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="year" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 11, fontWeight: 600, fill: '#64748b'}}
                  tickFormatter={(val) => val >= 2026 ? `${val}(P)` : val}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 11, fontWeight: 600, fill: '#64748b'}}
                  domain={['dataMin - 0.2', 'dataMax + 0.2']} 
                />
                <Tooltip 
                  cursor={{stroke: '#10b981', strokeWidth: 2}}
                  contentStyle={{
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    padding: '12px'
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)} t/ha`, 'Yield']}
                  labelFormatter={(label) => `Season: ${label}${label >= 2026 ? ' (Projected)' : ''}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="yield_tha" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  fill="url(#colorYield)" 
                  name="Yield (t/ha)"
                  animationDuration={2000}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};