import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/config";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, ShieldAlert, Eye, CheckCircle2,
  RefreshCw, FileText, ChevronDown, ChevronUp,
  Loader2, Zap, Info, TrendingDown, TrendingUp
} from "lucide-react";

interface CountyTriage {
  county: string;
  predicted_yield: number;
  historical_mean: number;
  deviation_pct: number;
  alert: "CRITICAL" | "ALERT" | "WATCH" | "NORMAL";
  action: string;
  is_predicted: boolean;
}

interface TriageSummary {
  critical: number;
  alert: number;
  watch: number;
  normal: number;
  total_counties: number;
}

interface NationalTriageMapProps {
  year: number;
  crop: string;
  onCountySelect?: (county: string) => void;
}

const ALERT_CONFIG = {
  CRITICAL: {
    color: "text-red-400",
    bg: "bg-red-950/60",
    border: "border-red-800/60",
    badge: "bg-red-900 text-red-200 border-red-700",
    dot: "bg-red-500",
    icon: AlertTriangle,
    pulse: true,
  },
  ALERT: {
    color: "text-orange-400",
    bg: "bg-orange-950/60",
    border: "border-orange-800/60",
    badge: "bg-orange-900 text-orange-200 border-orange-700",
    dot: "bg-orange-500",
    icon: ShieldAlert,
    pulse: false,
  },
  WATCH: {
    color: "text-yellow-400",
    bg: "bg-yellow-950/40",
    border: "border-yellow-800/40",
    badge: "bg-yellow-900/60 text-yellow-200 border-yellow-700",
    dot: "bg-yellow-500",
    icon: Eye,
    pulse: false,
  },
  NORMAL: {
    color: "text-emerald-400",
    bg: "bg-emerald-950/20",
    border: "border-emerald-900/30",
    badge: "bg-emerald-900/40 text-emerald-300 border-emerald-800",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
    pulse: false,
  },
};

export const NationalTriageMap = ({ year, crop, onCountySelect }: NationalTriageMapProps) => {
  const [data, setData] = useState<{ summary: TriageSummary; counties: CountyTriage[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterAlert, setFilterAlert] = useState<string>("ALL");
  const [expandedCounty, setExpandedCounty] = useState<string | null>(null);
  const [advisoryLoading, setAdvisoryLoading] = useState<string | null>(null);
  const [advisories, setAdvisories] = useState<Record<string, string>>({});

  const fetchTriage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/national-triage`, {
        params: { year, crop },
      });
      setData(res.data);
    } catch {
      setError("Failed to load national triage data.");
    } finally {
      setLoading(false);
    }
  }, [year, crop]);

  useEffect(() => {
    fetchTriage();
  }, [fetchTriage]);

  const fetchAdvisory = async (county: CountyTriage) => {
    if (advisories[county.county]) return;
    setAdvisoryLoading(county.county);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/advisory/generate`, {
        params: {
          county: county.county,
          crop,
          year,
          deviation_pct: county.deviation_pct,
        },
      });
      setAdvisories((prev) => ({ ...prev, [county.county]: res.data.advisory }));
    } catch {
      setAdvisories((prev) => ({
        ...prev,
        [county.county]: "Advisory unavailable. Please try again.",
      }));
    } finally {
      setAdvisoryLoading(null);
    }
  };

  const handleExpand = (county: CountyTriage) => {
    const isExpanding = expandedCounty !== county.county;
    setExpandedCounty(isExpanding ? county.county : null);
    if (isExpanding) fetchAdvisory(county);
  };

  const filtered = data?.counties.filter(
    (c) => filterAlert === "ALL" || c.alert === filterAlert
  ) || [];

  const summaryCards = data
    ? [
        { label: "Critical", count: data.summary.critical, key: "CRITICAL", color: "text-red-400", bg: "bg-red-950/50 border-red-800/50" },
        { label: "Alert", count: data.summary.alert, key: "ALERT", color: "text-orange-400", bg: "bg-orange-950/50 border-orange-800/50" },
        { label: "Watch", count: data.summary.watch, key: "WATCH", color: "text-yellow-400", bg: "bg-yellow-950/30 border-yellow-800/30" },
        { label: "Normal", count: data.summary.normal, key: "NORMAL", color: "text-emerald-400", bg: "bg-emerald-950/30 border-emerald-900/30" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">
            National Command Center
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            All counties ranked by food security alert level — {crop} · {year}
          </p>
        </div>
        <Button
          onClick={fetchTriage}
          disabled={loading}
          variant="outline"
          className="border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-300 font-bold gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summaryCards.map((s) => (
            <button
              key={s.key}
              onClick={() => setFilterAlert(filterAlert === s.key ? "ALL" : s.key)}
              className={`p-4 rounded-2xl border text-left transition-all hover:scale-105 ${s.bg} ${
                filterAlert === s.key ? "ring-2 ring-offset-2 ring-offset-slate-950 ring-current" : ""
              }`}
            >
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">{s.label}</p>
              <p className={`text-4xl font-black mt-1 ${s.color}`}>{s.count}</p>
              <p className="text-xs text-slate-500 mt-1">counties</p>
            </button>
          ))}
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {["ALL", "CRITICAL", "ALERT", "WATCH", "NORMAL"].map((f) => (
          <button
            key={f}
            onClick={() => setFilterAlert(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all border ${
              filterAlert === f
                ? "bg-emerald-600 border-emerald-500 text-white"
                : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            {f === "ALL" ? `All (${data?.summary.total_counties || 0})` : f}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-950/30 border border-red-800 rounded-xl flex items-center gap-3 text-red-400">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800/40 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* County Triage List */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((county, idx) => {
            const cfg = ALERT_CONFIG[county.alert];
            const AlertIcon = cfg.icon;
            const isExpanded = expandedCounty === county.county;

            return (
              <motion.div
                key={county.county}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02, duration: 0.3 }}
              >
                <Card
                  className={`border transition-all ${cfg.border} ${cfg.bg} ${
                    isExpanded ? "shadow-2xl" : "hover:shadow-lg"
                  }`}
                >
                  {/* Main Row */}
                  <button
                    className="w-full p-4 flex items-center gap-4 text-left"
                    onClick={() => handleExpand(county)}
                  >
                    {/* Rank */}
                    <span className="text-xs font-black text-slate-600 w-6 flex-shrink-0 text-center">
                      {idx + 1}
                    </span>

                    {/* Alert Icon + Dot */}
                    <div className="relative flex-shrink-0">
                      <AlertIcon className={`h-5 w-5 ${cfg.color}`} />
                      {cfg.pulse && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-ping" />
                      )}
                    </div>

                    {/* County Name */}
                    <div className="flex-1 min-w-0">
                      <button
                        className={`font-black text-base hover:underline ${cfg.color}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCountySelect?.(county.county);
                        }}
                      >
                        {county.county}
                      </button>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{county.action}</p>
                    </div>

                    {/* Yield Numbers */}
                    <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-bold uppercase">Forecast</p>
                        <p className="text-lg font-black text-white">
                          {county.predicted_yield.toFixed(2)}
                          <span className="text-xs text-slate-400 ml-1">t/ha</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-bold uppercase">Baseline</p>
                        <p className="text-lg font-black text-slate-400">
                          {county.historical_mean.toFixed(2)}
                          <span className="text-xs text-slate-500 ml-1">t/ha</span>
                        </p>
                      </div>
                      <div className="text-right w-24">
                        <p className="text-xs text-slate-500 font-bold uppercase">Deviation</p>
                        <div className="flex items-center justify-end gap-1">
                          {county.deviation_pct < 0 ? (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          ) : (
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                          )}
                          <p
                            className={`text-lg font-black ${
                              county.deviation_pct <= -25
                                ? "text-red-400"
                                : county.deviation_pct <= -10
                                ? "text-yellow-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {county.deviation_pct > 0 ? "+" : ""}
                            {county.deviation_pct.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Alert Badge */}
                    <Badge
                      variant="outline"
                      className={`flex-shrink-0 font-black text-xs uppercase ${cfg.badge}`}
                    >
                      {county.alert}
                    </Badge>

                    {/* Expand Toggle */}
                    <div className={`flex-shrink-0 ${cfg.color}`}>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Advisory Panel */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <CardContent className="pt-0 pb-5 px-5 border-t border-slate-800/60">
                          <div className="mt-4 space-y-4">
                            {/* Mobile yield numbers */}
                            <div className="flex md:hidden gap-4 flex-wrap">
                              <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Forecast</p>
                                <p className="text-base font-black text-white">
                                  {county.predicted_yield.toFixed(2)} t/ha
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Baseline</p>
                                <p className="text-base font-black text-slate-400">
                                  {county.historical_mean.toFixed(2)} t/ha
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Deviation</p>
                                <p className={`text-base font-black ${county.deviation_pct < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                  {county.deviation_pct > 0 ? "+" : ""}{county.deviation_pct.toFixed(1)}%
                                </p>
                              </div>
                            </div>

                            {/* Action Box */}
                            <div className={`p-4 rounded-xl border ${cfg.border} ${cfg.bg} flex gap-3`}>
                              <Info className={`h-5 w-5 flex-shrink-0 mt-0.5 ${cfg.color}`} />
                              <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">
                                  Recommended Government Action
                                </p>
                                <p className="text-sm text-slate-200 font-medium leading-relaxed">
                                  {county.action}
                                </p>
                              </div>
                            </div>

                            {/* Gemini Advisory */}
                            <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-emerald-400" />
                                  <p className="text-xs font-black uppercase tracking-widest text-emerald-400">
                                    AI Executive Advisory Bulletin
                                  </p>
                                </div>
                                {advisories[county.county] && (
                                  <button
                                    onClick={() =>
                                      setAdvisories((prev) => {
                                        const next = { ...prev };
                                        delete next[county.county];
                                        return next;
                                      })
                                    }
                                    className="text-xs text-slate-500 hover:text-slate-300 underline"
                                  >
                                    Regenerate
                                  </button>
                                )}
                              </div>

                              {advisoryLoading === county.county ? (
                                <div className="flex items-center gap-3 py-4">
                                  <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
                                  <p className="text-sm text-slate-400">
                                    Generating ministerial advisory...
                                  </p>
                                </div>
                              ) : advisories[county.county] ? (
                                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line prose prose-invert prose-sm max-w-none">
                                  {advisories[county.county]}
                                </div>
                              ) : (
                                <button
                                  onClick={() => fetchAdvisory(county)}
                                  className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-bold underline"
                                >
                                  <FileText className="h-4 w-4" />
                                  Generate AI Advisory Bulletin
                                </button>
                              )}
                            </div>

                            {/* View in Dashboard button */}
                            <Button
                              size="sm"
                              onClick={() => onCountySelect?.(county.county)}
                              className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold gap-2"
                            >
                              Open {county.county} in Dashboard →
                            </Button>
                          </div>
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="text-center py-16 text-slate-500">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-700" />
          <p className="font-bold">No counties match the selected filter.</p>
        </div>
      )}

      {/* Footer Note */}
      {data && (
        <p className="text-xs text-slate-600 text-center pt-2">
          Deviation calculated vs historical AFA mean · XGBoost + Earth Engine · AgriWatch KE © 2026
        </p>
      )}
    </div>
  );
};
