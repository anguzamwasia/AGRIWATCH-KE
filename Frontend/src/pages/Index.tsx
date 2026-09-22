import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { NationalTriageMap } from "@/components/NationalTriageMap";
import { ActionTriggerCard } from "@/components/ActionTriggerCard";
import { motion, AnimatePresence } from "framer-motion";
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
  MessageSquare,
  ShieldAlert,
  Sun,
  Moon
} from "lucide-react";
const Index = () => {
  const navigate = useNavigate();
  const [showDashboard, setShowDashboard] = useState<boolean>(true);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return (localStorage.getItem("agriwatch_theme") as "dark" | "light") || "dark";
    } catch {
      return "dark";
    }
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("agriwatch_theme", next);
    } catch (_) {}
  };

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const handleEnterDashboard = () => {
    try {
      localStorage.setItem("agriwatch_auth", "true");
    } catch (_) {}
    setShowDashboard(true);
  };

  const handleExitDashboard = () => {
    try {
      localStorage.removeItem("agriwatch_auth");
    } catch (_) {}
    setShowDashboard(false);
    navigate("/");
  };
  const [selectedCounty, setSelectedCounty] = useState<string>("Uasin Gishu");
  const [selectedSubcounty, setSelectedSubcounty] = useState<string>("Select subcounty");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedCrop, setSelectedCrop] = useState("Maize");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mapLayer, setMapLayer] = useState<'osm' | 'satellite' | 'pixel' | 'lulc'>('osm');
  const [isReportGenerating, setIsReportGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("map");
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  
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

  if (!showDashboard) return <LandingPage onEnter={handleEnterDashboard} />;

  const activeMetrics = trendData.find((d: any) => d.year === selectedYear) || 
                       (trendData.length > 0 ? trendData[trendData.length - 1] : null);

  const mergedChartData = trendData.map((d: any) => {
    const compMatch = compareTrendData.find((cd: any) => cd.year === d.year);
    return {
      ...d,
      compare_yield_tha: compMatch ? compMatch.yield_tha : null
    };
  });

  const handleDownloadReport = async () => {
    setIsReportGenerating(true);
    try {
      const element = document.getElementById("pdf-content");
      if (!element) {
        window.print();
        return;
      }
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`agriwatch_report_${selectedCounty.toLowerCase().replace(/ /g, "_")}_${selectedYear}.pdf`);
    } catch (error) {
      console.error("PDF download failed - falling back to browser print:", error);
      window.print();
    } finally {
      setIsReportGenerating(false);
    }
  };


  return (
    <div className={cn("min-h-screen p-4 md:p-8 font-sans transition-colors duration-300", theme === "dark" ? "dark bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900")}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* TOP NAVBAR / HEADER */}
        <div className={cn("flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-[2rem] shadow-2xl backdrop-blur-xl border transition-colors duration-300",
          theme === "dark" ? "bg-slate-900/50 border-slate-800 text-slate-100" : "bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/50"
        )}>
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600 p-2 rounded-xl shadow-[0_0_15px_rgba(5,150,105,0.5)]"><Brain className="h-6 w-6 text-white" /></div>
            <div>
              <h1 className={cn("text-xl font-black tracking-tight", theme === "dark" ? "text-slate-100" : "text-slate-900")}>National Food Security Dashboard</h1>
              <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", theme === "dark" ? "text-emerald-400 border-emerald-800/50 bg-emerald-900/20" : "text-emerald-700 border-emerald-300 bg-emerald-50")}>Executive Decision Support System</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className={cn("font-bold flex items-center gap-2 rounded-xl border transition-colors px-3 py-1.5",
                theme === "dark" 
                  ? "bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-700 hover:text-amber-300" 
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-sm"
              )}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span className="text-xs">Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-slate-700" />
                  <span className="text-xs">Dark</span>
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExitDashboard} className={cn("font-bold", theme === "dark" ? "text-slate-400 hover:text-red-400 hover:bg-slate-800" : "text-slate-600 hover:text-red-600 hover:bg-slate-100")}>
              <LogOut className="h-4 w-4 mr-2" /> Exit System
            </Button>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div id="dashboard-content" className="flex flex-col lg:flex-row gap-6">
          
          <div className={cn("transition-all duration-500 flex flex-col space-y-6", isSidebarCollapsed ? "lg:w-[5rem]" : "lg:w-1/4")}>
            <Card className={cn("border shadow-2xl rounded-[2.5rem] backdrop-blur-xl p-2 relative overflow-hidden h-fit transition-colors duration-300",
              theme === "dark" ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white/90 shadow-slate-200/50"
            )}>
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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={cn("grid w-full grid-cols-7 mb-6 p-1 shadow-2xl rounded-2xl backdrop-blur-xl border transition-colors duration-300",
                theme === "dark" ? "bg-slate-900/50 border-slate-800" : "bg-white/90 border-slate-200 shadow-slate-200/50"
              )}>
                <TabsTrigger value="map" className={cn("rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white", theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900")}><MapIcon className="w-4 h-4 mr-1" /> Map</TabsTrigger>
                <TabsTrigger value="predictors" className={cn("rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white", theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900")}><Activity className="w-4 h-4 mr-1" /> Predictors</TabsTrigger>
                <TabsTrigger value="phenology" className={cn("rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white", theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900")}><Sprout className="w-4 h-4 mr-1" /> Growth</TabsTrigger>
                <TabsTrigger value="charts" className={cn("rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white", theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900")}><ChartIcon className="w-4 h-4 mr-1" /> Trends</TabsTrigger>
                <TabsTrigger value="report" className={cn("rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white", theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900")}><ClipboardCheck className="w-4 h-4 mr-1" /> Report</TabsTrigger>
                <TabsTrigger value="triage" className={cn("rounded-xl font-bold text-xs uppercase data-[state=active]:bg-red-700 data-[state=active]:text-white", theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900")}><ShieldAlert className="w-4 h-4 mr-1" /> Risk Alerts</TabsTrigger>
                <TabsTrigger value="chatbot" className={cn("rounded-xl font-bold text-xs uppercase data-[state=active]:bg-emerald-600 data-[state=active]:text-white", theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900")}><MessageSquare className="w-4 h-4 mr-1" /> Advisor</TabsTrigger>
              </TabsList>

              <TabsContent value="map">
                <Card className={cn("shadow-2xl overflow-hidden rounded-[2.5rem] h-[650px] relative border transition-colors duration-300",
                  theme === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-slate-200/50"
                )}>
                  <YieldMap crop={selectedCrop} county={selectedCounty} subcounty={selectedSubcounty} year={selectedYear} layer={mapLayer} lulcMapPath={predictorData?.lulcMapPath || ""} predictedYield={apiData?.cards?.predicted_yield} baseYield={apiData?.cards?.base_yield} />
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
                    <Card className={cn("p-6 rounded-[2rem] shadow-2xl relative overflow-hidden h-full border transition-colors duration-300",
                      theme === "dark" ? "bg-emerald-950 border-emerald-900" : "bg-emerald-50 border-emerald-200"
                    )}>
                      <p className={cn("text-[11px] font-black uppercase tracking-widest mb-1", theme === "dark" ? "text-emerald-400" : "text-emerald-700")}>Average Yield</p>
                      <h3 className={cn("text-3xl font-black tracking-tighter", theme === "dark" ? "text-white" : "text-emerald-950")}>
                        {activeMetrics?.yield_tha?.toFixed(2) || "0.00"} <span className={cn("text-xs font-bold", theme === "dark" ? "text-emerald-500" : "text-emerald-700")}>t/ha</span>
                      </h3>
                      <TrendingUp className="absolute right-[-10px] bottom-[-10px] h-20 w-20 text-emerald-500/20" />
                    </Card>
                  </motion.div>

                  {/* 2. PRODUCTION */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <Card className={cn("p-6 rounded-[2rem] shadow-2xl relative overflow-hidden h-full border transition-colors duration-300",
                      theme === "dark" ? "bg-blue-950 border-blue-900" : "bg-blue-50 border-blue-200"
                    )}>
                      <p className={cn("text-[11px] font-black uppercase tracking-widest mb-1", theme === "dark" ? "text-blue-400" : "text-blue-700")}>Total Production</p>
                      <h3 className={cn("text-3xl font-black tracking-tighter", theme === "dark" ? "text-white" : "text-blue-950")}>
                        {activeMetrics?.production_tons ? (activeMetrics.production_tons / 1000).toFixed(1) : "0.0"} <span className={cn("text-xs font-bold", theme === "dark" ? "text-blue-500" : "text-blue-700")}>k Tons</span>
                      </h3>
                      <Maximize className="absolute right-[-10px] bottom-[-10px] h-20 w-20 text-blue-500/20" />
                    </Card>
                  </motion.div>

                  {/* 3. AREA (NEW) */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                    <Card className={cn("p-6 rounded-[2rem] shadow-2xl relative overflow-hidden h-full border transition-colors duration-300",
                      theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-slate-200/50"
                    )}>
                      <p className={cn("text-[11px] font-black uppercase tracking-widest mb-1", theme === "dark" ? "text-slate-400" : "text-slate-500")}>Area Cultivated</p>
                      <h3 className={cn("text-3xl font-black tracking-tighter", theme === "dark" ? "text-white" : "text-slate-900")}>
                        {activeMetrics?.area_ha ? Math.round(activeMetrics.area_ha).toLocaleString() : "0"} <span className="text-xs font-bold text-slate-500">Ha</span>
                      </h3>
                      <Layers className="absolute right-[-10px] bottom-[-10px] h-20 w-20 text-slate-500/20" />
                    </Card>
                  </motion.div>
                </div>

                <Card className={cn("p-6 md:p-8 shadow-2xl rounded-[2.5rem] border transition-colors duration-300",
                  theme === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-slate-200/50"
                )}>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h3 className={cn("text-xl font-black tracking-tight", theme === "dark" ? "text-slate-100" : "text-slate-900")}>Historical Yield Timeline ({selectedCrop})</h3>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-bold", theme === "dark" ? "text-slate-400" : "text-slate-600")}>Compare vs:</span>
                      <select 
                        value={compareCrop} 
                        onChange={(e) => setCompareCrop(e.target.value)}
                        className={cn("text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2 font-bold border",
                          theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-800"
                        )}
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
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === "dark" ? "#334155" : "#e2e8f0"} />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: theme === "dark" ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 'bold'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: theme === "dark" ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 'bold'}} dx={-10} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)', background: theme === "dark" ? '#1e293b' : '#ffffff', color: theme === "dark" ? '#f8fafc' : '#0f172a', fontWeight: 'bold'}}
                          itemStyle={{fontWeight: 'black'}}
                          cursor={{stroke: theme === "dark" ? '#334155' : '#cbd5e1', strokeWidth: 2, strokeDasharray: '4 4'}}
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
                <div className="space-y-6">
                  {/* Action Trigger Card — decision maker layer */}
                  {apiData?.cards && (
                    <Card className={cn("shadow-2xl rounded-[2.5rem] p-6 md:p-8 border transition-colors duration-300",
                      theme === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-slate-200/50"
                    )}>
                      <ActionTriggerCard
                        county={selectedCounty}
                        crop={selectedCrop}
                        year={selectedYear}
                        predictedYield={parseFloat(String(apiData.cards.predicted_yield || 0))}
                        historicalMean={(() => {
                          const hist = trendData.filter((d: any) => d.year >= 2017 && d.year <= 2025);
                          if (hist.length === 0) return parseFloat(String(apiData.cards.predicted_yield || 0));
                          const avg = hist.reduce((s: number, d: any) => s + (d.yield_tha || 0), 0) / hist.length;
                          return avg;
                        })()}
                      />
                    </Card>
                  )}
                  {/* Full Yield Report */}
                  <Card className={cn("print-wrapper print-only p-8 shadow-2xl rounded-[2.5rem] border transition-colors duration-300",
                    theme === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-slate-200/50"
                  )}>
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
                </div>
              </TabsContent>

              <TabsContent value="triage">
                <Card className={cn("shadow-2xl rounded-[2.5rem] p-6 md:p-8 border transition-colors duration-300",
                  theme === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-slate-200/50"
                )}>
                  <NationalTriageMap
                    year={selectedYear}
                    crop={selectedCrop}
                    onCountySelect={(county) => {
                      setSelectedCounty(county);
                      setSelectedSubcounty("");
                      setActiveTab("map");
                    }}
                  />
                </Card>
              </TabsContent>

              <TabsContent value="chatbot">
                <Card className={cn("shadow-2xl overflow-hidden rounded-[2.5rem] h-[650px] border transition-colors duration-300",
                  theme === "dark" ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white shadow-slate-200/50"
                )}>
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