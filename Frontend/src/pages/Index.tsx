import { useState, useEffect } from "react";
import { API_BASE_URL } from "../config";
import axios from "axios";
import 'mapbox-gl/dist/mapbox-gl.css'; 
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

// Components
import { MapControls } from "@/components/MapControls";
import { YieldMap } from "@/components/YieldMap";
import { PredictorCharts } from "@/components/PredictorCharts";
import { PredictorInputs } from "@/components/PredictorInputs";
import { ReportGenerator } from "@/components/ReportGenerator";
import { PredictorDeepDive } from "@/components/PredictorDeepDive";
import PhenologyAnalysis from "@/components/PhenologyAnalysis";
import LandingPage from "@/components/LandingPage";
import { DataChatbot } from "@/components/DataChatbot";
import { motion } from "framer-motion";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// UI Components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  AlertCircle, 
  Sprout, 
  LineChart as ChartIcon, 
  Map as MapIcon, 
  ClipboardCheck,
  LogOut,
  Activity,
  TrendingUp,
  Maximize,
  Layers,
  MessageSquare
} from "lucide-react";

const Index = () => {
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
  const [selectedCounty, setSelectedCounty] = useState<string>("Uasin Gishu");
  const [selectedSubcounty, setSelectedSubcounty] = useState<string>("Select subcounty");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedCrop, setSelectedCrop] = useState("Maize");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mapLayer, setMapLayer] = useState<'osm' | 'satellite' | 'pixel'>('osm');
  const [isReportGenerating, setIsReportGenerating] = useState(false);
  
  const [apiData, setApiData] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [predictorData, setPredictorData] = useState<any>(null);
  const [compareCrop, setCompareCrop] = useState<string>("None");
  const [compareTrendData, setCompareTrendData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!showDashboard) return; 
      setIsLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/yield-analysis`, {
          params: {
            county: selectedCounty,
            subcounty: selectedSubcounty === "Select subcounty" ? "" : selectedSubcounty,
            year: selectedYear,
            crop: selectedCrop
          }
        });
        setApiData(response.data);
      } catch (err) {
        setError("GeoAI Service Offline.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalysis();
  }, [selectedCounty, selectedSubcounty, selectedYear, selectedCrop, showDashboard]);

  useEffect(() => {
    const fetchTrends = async () => {
      if (!showDashboard) return;
      try {
        const response = await axios.get(`${API_BASE_URL}/api/analytics/trends`, {
          params: { 
            county: selectedCounty, 
            subcounty: selectedSubcounty === "Select subcounty" ? "" : selectedSubcounty,
            year: selectedYear,
            crop: selectedCrop
          }
        });
        setTrendData(response.data.trends || []);
      } catch (err) {
        console.error("Trend fetch failed", err);
      }
    };
    fetchTrends();
  }, [selectedCounty, selectedSubcounty, selectedYear, selectedCrop, showDashboard]);

  useEffect(() => {
    const fetchCompareTrends = async () => {
      if (!showDashboard || compareCrop === "None") {
        setCompareTrendData([]);
        return;
      }
      try {
        const response = await axios.get(`${API_BASE_URL}/api/analytics/trends`, {
          params: { 
            county: selectedCounty, 
            subcounty: selectedSubcounty === "Select subcounty" ? "" : selectedSubcounty,
            year: selectedYear,
            crop: compareCrop
          }
        });
        setCompareTrendData(response.data.trends || []);
      } catch (err) {
        console.error("Compare trend fetch failed", err);
      }
    };
    fetchCompareTrends();
  }, [selectedCounty, selectedSubcounty, selectedYear, compareCrop, showDashboard]);



  const [phenologyData, setPhenologyData] = useState<any>(null);

  useEffect(() => {
    const fetchPredictors = async () => {
      if (!showDashboard || !selectedCounty) return;
      try {
        const response = await axios.get(`${API_BASE_URL}/api/analytics/predictors`, {
          params: { county: selectedCounty, subcounty: selectedSubcounty === "Select subcounty" ? "" : selectedSubcounty, year: selectedYear, crop: selectedCrop }
        });
        setPredictorData(response.data);
      } catch (err) { console.error(err); }
    };
    fetchPredictors();
  }, [selectedCounty, selectedSubcounty, selectedYear, selectedCrop, showDashboard]);

  useEffect(() => {
    const fetchPhenology = async () => {
      if (!showDashboard || !selectedCounty) return;
      try {
        const response = await axios.get(`${API_BASE_URL}/api/analytics/phenology`, {
          params: { county: selectedCounty, subcounty: selectedSubcounty === "Select subcounty" ? "" : selectedSubcounty, year: selectedYear }
        });
        setPhenologyData(response.data);
      } catch (err) { console.error("Phenology fetch failed", err); }
    };
    fetchPhenology();
  }, [selectedCounty, selectedSubcounty, selectedYear, showDashboard]);

  if (!showDashboard) return <LandingPage onEnter={() => setShowDashboard(true)} />;

  const activeMetrics = trendData.find((d: any) => d.year === selectedYear) || 
                       (trendData.length > 0 ? trendData[trendData.length - 1] : null);

  const mergedChartData = trendData.map((d: any) => {
    const compMatch = compareTrendData.find((cd: any) => cd.year === d.year);
    return {
      ...d,
      compare_yield_tha: compMatch ? compMatch.yield_tha : null
    };
  });

  const handleDownloadReport = () => {
    setIsReportGenerating(true);
    setTimeout(() => {
      window.print();
      setIsReportGenerating(false);
    }, 500);
  };

  return (
    <div className="dark min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* TOP NAVBAR / HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 p-6 rounded-[2rem] shadow-2xl backdrop-blur-xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600 p-2 rounded-xl shadow-[0_0_15px_rgba(5,150,105,0.5)]"><Brain className="h-6 w-6 text-white" /></div>
            <div>
              <h1 className="text-xl font-black text-slate-100 tracking-tight">National Food Security Dashboard</h1>
              <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-400 border-emerald-800/50 bg-emerald-900/20">Executive Decision Support System</Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowDashboard(false)} className="text-slate-400 hover:text-red-400 hover:bg-slate-800 font-bold">
            <LogOut className="h-4 w-4 mr-2" /> Exit System
          </Button>
        </div>

        {/* MAIN CONTENT AREA */}
        <div id="dashboard-content" className="flex flex-col lg:flex-row gap-6">
          
          <div className={cn("transition-all duration-500 flex flex-col space-y-6", isSidebarCollapsed ? "lg:w-[5rem]" : "lg:w-1/4")}>
            <Card className="border-slate-800 shadow-2xl rounded-[2.5rem] bg-slate-900/50 backdrop-blur-xl p-2 relative overflow-hidden h-fit">
              <MapControls 
                selectedCounty={selectedCounty} onCountyChange={setSelectedCounty}
                selectedSubcounty={selectedSubcounty} onSubcountyChange={setSelectedSubcounty}
                selectedYear={selectedYear} onYearChange={setSelectedYear}
                selectedCrop={selectedCrop} onCropChange={setSelectedCrop}
                mapLayer={mapLayer} onLayerChange={setMapLayer}
                onDownloadReport={handleDownloadReport}
                isCollapsed={isSidebarCollapsed}
                setIsCollapsed={setIsSidebarCollapsed}
                isGeneratingReport={isReportGenerating}
              />
            </Card>
            {!isSidebarCollapsed && (
              <PredictorInputs county={selectedCounty} year={selectedYear} crop={selectedCrop} apiData={apiData} />
            )}
          </div>

          <div className={cn("transition-all duration-500", isSidebarCollapsed ? "lg:w-[calc(100%-6.5rem)]" : "lg:w-3/4")}>
            {isLoading && <div className="p-4 bg-emerald-900/20 border border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-400 mb-6"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-400" /><p className="text-sm font-bold uppercase">Running GeoAI Models...</p></div>}
            {error && <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl flex items-center gap-3 text-red-400 mb-6"><AlertCircle className="h-5 w-5" /><p className="text-sm font-bold uppercase">{error}</p></div>}

            <Tabs defaultValue="map" className="w-full">
              <TabsList className="grid w-full grid-cols-6 mb-6 bg-slate-900/50 p-1 shadow-2xl border border-slate-800 rounded-2xl backdrop-blur-xl">
                <TabsTrigger value="map" className="rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 hover:text-slate-200"><MapIcon className="w-4 h-4 mr-2" /> Map</TabsTrigger>
                <TabsTrigger value="predictors" className="rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 hover:text-slate-200"><Activity className="w-4 h-4 mr-2" /> Predictors</TabsTrigger>
                <TabsTrigger value="phenology" className="rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 hover:text-slate-200"><Sprout className="w-4 h-4 mr-2" /> Growth</TabsTrigger>
                <TabsTrigger value="charts" className="rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 hover:text-slate-200"><ChartIcon className="w-4 h-4 mr-2" /> Trends</TabsTrigger>
                <TabsTrigger value="report" className="rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 hover:text-slate-200"><ClipboardCheck className="w-4 h-4 mr-2" /> Report</TabsTrigger>
                <TabsTrigger value="chatbot" className="rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-400 hover:text-slate-200"><MessageSquare className="w-4 h-4 mr-2" /> Advisor</TabsTrigger>
              </TabsList>

              <TabsContent value="map">
                <Card className="border-slate-800 shadow-2xl overflow-hidden rounded-[2.5rem] bg-slate-900 h-[650px] relative">
                  <YieldMap crop={selectedCrop} county={selectedCounty} subcounty={selectedSubcounty} year={selectedYear} layer={mapLayer} lulcMapPath={predictorData?.lulcMapPath || ""} />
                </Card>
              </TabsContent>

              <TabsContent value="predictors">
                <PredictorDeepDive 
                  crop={selectedCrop} 
                  year={selectedYear} 
                  county={selectedCounty}
                  subcounty={selectedSubcounty}
                  monthlyData={predictorData?.monthlyData || []} 
                  soilData={predictorData?.soilData} 
                  mapPath={predictorData?.mapPath || ""}
                  lulcMapPath={predictorData?.lulcMapPath || ""}
                />
              </TabsContent>

              <TabsContent value="phenology">
                <PhenologyAnalysis selectedCounty={selectedCounty} selectedSubcounty={selectedSubcounty} selectedYear={selectedYear} />
              </TabsContent>

              <TabsContent value="charts" className="space-y-6">
                {/* THREE-CARD METRIC GRID */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 1. YIELD */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    <Card className="bg-emerald-950 border-emerald-900 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden h-full">
                      <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest mb-1">Average Yield</p>
                      <h3 className="text-3xl font-black text-white tracking-tighter">
                        {activeMetrics?.yield_tha?.toFixed(2) || "0.00"} <span className="text-xs font-bold text-emerald-500">t/ha</span>
                      </h3>
                      <TrendingUp className="absolute right-[-10px] bottom-[-10px] h-20 w-20 text-emerald-500/20" />
                    </Card>
                  </motion.div>

                  {/* 2. PRODUCTION */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <Card className="bg-blue-950 border-blue-900 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden h-full">
                      <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Production</p>
                      <h3 className="text-3xl font-black text-white tracking-tighter">
                        {activeMetrics?.production_tons ? (activeMetrics.production_tons / 1000).toFixed(1) : "0.0"} <span className="text-xs font-bold text-blue-500">k Tons</span>
                      </h3>
                      <Maximize className="absolute right-[-10px] bottom-[-10px] h-20 w-20 text-blue-500/20" />
                    </Card>
                  </motion.div>

                  {/* 3. AREA (NEW) */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                    <Card className="bg-slate-900 border-slate-800 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden h-full">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Area Cultivated</p>
                      <h3 className="text-3xl font-black text-white tracking-tighter">
                        {activeMetrics?.area_ha ? Math.round(activeMetrics.area_ha).toLocaleString() : "0"} <span className="text-xs font-bold text-slate-500">Ha</span>
                      </h3>
                      <Layers className="absolute right-[-10px] bottom-[-10px] h-20 w-20 text-slate-500/20" />
                    </Card>
                  </motion.div>
                </div>

                <Card className="p-6 md:p-8 border-slate-800 shadow-2xl rounded-[2.5rem] bg-slate-900">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h3 className="text-xl font-black text-slate-100 tracking-tight">Historical Yield Timeline ({selectedCrop})</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-400">Compare vs:</span>
                      <select 
                        value={compareCrop} 
                        onChange={(e) => setCompareCrop(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2 font-bold"
                      >
                        <option value="None">None</option>
                        {["Maize", "Wheat", "Potatoes", "Pigeonpeas"].filter(c => c !== selectedCrop).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mergedChartData}>
                        <defs>
                          <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.5}/>
                            <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCompare" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} dx={-10} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', background: '#1e293b', color: '#f8fafc', fontWeight: 'bold'}}
                          itemStyle={{fontWeight: 'black'}}
                          cursor={{stroke: '#334155', strokeWidth: 2, strokeDasharray: '4 4'}}
                        />
                        <Area type="monotone" name={selectedCrop} dataKey="yield_tha" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorYield)" />
                        {compareCrop !== "None" && (
                          <Area type="monotone" name={compareCrop} dataKey="compare_yield_tha" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorCompare)" />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="report">
                <Card className="print-wrapper print-only p-8 border-slate-800 shadow-2xl rounded-[2.5rem] bg-slate-900">
                  <ReportGenerator 
                    county={selectedCounty} 
                    subcounty={selectedSubcounty} 
                    year={selectedYear} 
                    crop={selectedCrop}
                    yieldData={apiData?.cards} 
                    trendData={trendData}
                    predictorData={predictorData}
                    phenologyData={phenologyData}
                    onDownload={handleDownloadReport}
                    isGenerating={isReportGenerating}
                  />
                </Card>
              </TabsContent>

              <TabsContent value="chatbot">
                <Card className="border-slate-800 shadow-2xl overflow-hidden rounded-[2.5rem] bg-slate-900 h-[650px]">
                  <DataChatbot selectedCounty={selectedCounty} selectedCrop={selectedCrop} />
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;