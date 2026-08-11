import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, ShieldAlert, Eye, CheckCircle2,
  Banknote, Wheat, PhoneCall, TrendingDown, TrendingUp,
  ArrowRight
} from "lucide-react";

interface ActionTriggerCardProps {
  county: string;
  crop: string;
  year: number;
  predictedYield: number;
  historicalMean: number;
  deviationPct?: number;
}

const TRIGGERS = [
  {
    key: "CRITICAL",
    range: "≤ −35%",
    label: "CRITICAL",
    sublabel: "Yield Collapse",
    color: "text-red-400",
    bg: "from-red-950/80 to-slate-950",
    border: "border-red-800/70",
    glow: "shadow-[0_0_30px_rgba(239,68,68,0.15)]",
    badgeCls: "bg-red-900 border-red-700 text-red-200",
    icon: AlertTriangle,
    pulse: true,
    tier: "Tier 4 — National Emergency",
    actions: [
      { icon: PhoneCall, text: "Declare food security emergency. Notify WFP & NDMA immediately." },
      { icon: Banknote, text: "Activate National Disaster Fund (Cap. 259). Release emergency supplemental budget." },
      { icon: Wheat, text: "Deploy strategic grain reserve. Coordinate with WFP for food import bridge." },
    ],
    monitoring: "Weekly NDVI satellite check + monthly field validation by county agronomists.",
  },
  {
    key: "ALERT",
    range: "−25% to −35%",
    label: "ALERT",
    sublabel: "Severe Deficit",
    color: "text-orange-400",
    bg: "from-orange-950/70 to-slate-950",
    border: "border-orange-800/60",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.1)]",
    badgeCls: "bg-orange-900 border-orange-700 text-orange-200",
    icon: ShieldAlert,
    pulse: false,
    tier: "Tier 3 — County Emergency",
    actions: [
      { icon: Banknote, text: "Activate county emergency contingency budget. Authorize seed subsidy release." },
      { icon: Wheat, text: "Pre-position drought-tolerant variety seeds via Kenya Seed Company depots." },
      { icon: PhoneCall, text: "Alert NDMA & county Agriculture CEC. Trigger anticipatory cash transfer." },
    ],
    monitoring: "Bi-weekly crop condition reports from sub-county extension officers.",
  },
  {
    key: "WATCH",
    range: "−10% to −25%",
    label: "WATCH",
    sublabel: "Below Average",
    color: "text-yellow-400",
    bg: "from-yellow-950/50 to-slate-950",
    border: "border-yellow-800/40",
    glow: "",
    badgeCls: "bg-yellow-900/60 border-yellow-700 text-yellow-200",
    icon: Eye,
    pulse: false,
    tier: "Tier 2 — Enhanced Monitoring",
    actions: [
      { icon: Wheat, text: "Alert NDMA. Pre-position food reserves and subsidized fertilizer in affected wards." },
      { icon: PhoneCall, text: "Double frequency of extension officer farm visits in high-risk subcounties." },
      { icon: Banknote, text: "Notify county treasury to ring-fence contingency budget for potential activation." },
    ],
    monitoring: "Monthly yield estimate updates. Track rainfall deviation vs seasonal norm.",
  },
  {
    key: "NORMAL",
    range: "Above −10%",
    label: "NORMAL",
    sublabel: "On Track",
    color: "text-emerald-400",
    bg: "from-emerald-950/30 to-slate-950",
    border: "border-emerald-900/30",
    glow: "",
    badgeCls: "bg-emerald-900/50 border-emerald-800 text-emerald-300",
    icon: CheckCircle2,
    pulse: false,
    tier: "Tier 1 — Standard Protocol",
    actions: [
      { icon: Wheat, text: "Maintain standard extension service deployment and input supply chain monitoring." },
      { icon: PhoneCall, text: "Continue routine KALRO seasonal crop assessment. Share progress with county." },
      { icon: Banknote, text: "No emergency budget activation required. Maintain contingency reserve." },
    ],
    monitoring: "Quarterly crop performance review. Standard agrometeorological bulletin.",
  },
];

// Crop-specific trigger thresholds in deviation % (reflecting agronomic drought tolerance)
const CROP_TRIGGER_THRESHOLDS: Record<string, { critical: number; alert: number; watch: number }> = {
  Maize:      { critical: -20, alert: -15, watch: -8 },
  Wheat:      { critical: -25, alert: -18, watch: -10 },
  Potatoes:   { critical: -30, alert: -20, watch: -12 },
  Pigeonpeas: { critical: -40, alert: -30, watch: -15 },
};

export const ActionTriggerCard = ({
  county,
  crop,
  year,
  predictedYield,
  historicalMean,
  deviationPct,
}: ActionTriggerCardProps) => {
  const deviation =
    deviationPct !== undefined
      ? deviationPct
      : historicalMean > 0
      ? ((predictedYield - historicalMean) / historicalMean) * 100
      : 0;

  const thresh = CROP_TRIGGER_THRESHOLDS[crop] ?? CROP_TRIGGER_THRESHOLDS.Maize;

  // Build dynamic trigger reference list with crop-specific thresholds
  const dynamicTriggers = [
    {
      ...TRIGGERS[0],
      range: `≤ ${thresh.critical}%`,
    },
    {
      ...TRIGGERS[1],
      range: `${thresh.alert}% to ${thresh.critical}%`,
    },
    {
      ...TRIGGERS[2],
      range: `${thresh.watch}% to ${thresh.alert}%`,
    },
    {
      ...TRIGGERS[3],
      range: `Above ${thresh.watch}%`,
    },
  ];

  const activeTrigger =
    deviation <= thresh.critical
      ? dynamicTriggers[0]
      : deviation <= thresh.alert
      ? dynamicTriggers[1]
      : deviation <= thresh.watch
      ? dynamicTriggers[2]
      : dynamicTriggers[3];

  const ActiveIcon = activeTrigger.icon;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-lg font-black text-slate-100 tracking-tight">
          Anticipatory Action Trigger
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {county} County · {crop} · {year} — Government response protocol
        </p>
      </div>

      {/* Active Trigger Card */}
      <motion.div
        key={activeTrigger.key}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          className={`bg-gradient-to-br ${activeTrigger.bg} border ${activeTrigger.border} ${activeTrigger.glow} rounded-[2rem] overflow-hidden`}
        >
          <CardContent className="p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`relative p-2.5 rounded-xl border ${activeTrigger.border} bg-slate-900/60`}>
                  <ActiveIcon className={`h-6 w-6 ${activeTrigger.color}`} />
                  {activeTrigger.pulse && (
                    <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                  )}
                </div>
                <div>
                  <Badge variant="outline" className={`font-black text-sm px-3 py-1 ${activeTrigger.badgeCls}`}>
                    {activeTrigger.label}
                  </Badge>
                  <p className="text-xs text-slate-400 mt-1">{activeTrigger.sublabel}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 font-bold">{activeTrigger.tier}</span>
                <p className="text-lg font-black text-slate-200 mt-0.5">
                  {deviation > 0 ? "+" : ""}
                  {deviation.toFixed(1)}% Dev
                </p>
              </div>
            </div>

            {/* Deviation Context */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col md:flex-row justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Predicted Yield
                </p>
                <p className="text-xl font-black text-emerald-400 mt-0.5">
                  {predictedYield.toFixed(2)} t/ha
                </p>
              </div>
              <div className="hidden md:block border-l border-slate-800" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Historical Baseline
                </p>
                <p className="text-xl font-bold text-slate-300 mt-0.5">
                  {historicalMean.toFixed(2)} t/ha
                </p>
              </div>
              <div className="hidden md:block border-l border-slate-800" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Deviation Type
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {deviation >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  <span className={`text-xs font-black uppercase ${deviation >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {deviation >= 0 ? "Surplus" : "Deficit"}
                  </span>
                </div>
              </div>
            </div>

            {/* Recommended Actions */}
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                Triggered Actions
              </p>
              {activeTrigger.actions.map((action, i) => {
                const ActionIcon = action.icon;
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-xl border ${activeTrigger.border} bg-slate-900/30`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-lg border ${activeTrigger.border} flex-shrink-0`}>
                      <ActionIcon className={`h-3.5 w-3.5 ${activeTrigger.color}`} />
                    </div>
                    <div>
                      <span className={`text-xs font-black ${activeTrigger.color} flex-shrink-0`}>{i + 1}.</span>
                      <p className="text-xs text-slate-300 font-medium leading-relaxed inline ml-1">
                        {action.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Monitoring */}
            <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/20">
              <ArrowRight className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                  Monitoring Protocol
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">{activeTrigger.monitoring}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Trigger Scale Reference */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/30">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
          Trigger Threshold Reference
        </p>
        <div className="space-y-1.5">
          {dynamicTriggers.map((t) => {
            const TIcon = t.icon;
            const isActive = t.key === activeTrigger.key;
            return (
              <div
                key={t.key}
                className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                  isActive ? `border ${t.border} ${t.bg.split(" ")[0]}` : "opacity-50"
                }`}
              >
                <TIcon className={`h-3.5 w-3.5 ${t.color} flex-shrink-0`} />
                <Badge variant="outline" className={`text-[10px] font-black ${t.badgeCls}`}>
                  {t.label}
                </Badge>
                <span className="text-xs text-slate-400 font-medium">{t.range}</span>
                <span className="text-xs text-slate-600 ml-auto">{t.tier}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
