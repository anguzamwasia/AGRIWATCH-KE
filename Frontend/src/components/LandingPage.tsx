import React from 'react';
import { Button } from "@/components/ui/button"; 
import { 
  Brain, 
  Sprout, 
  LineChart as ChartIcon, 
  Map as MapIcon, 
  ChevronRight
} from "lucide-react";
import heroImage from "@/assets/kenya-fields-hero.jpg";

interface LandingPageProps {
  onEnter: () => void;
}

const LandingPage = ({ onEnter }: LandingPageProps) => {
  return (
    <div className="min-h-screen bg-white relative">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage} 
            alt="Kenyan Farmland" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10 text-white">
          <div className="max-w-3xl space-y-6 animate-in slide-in-from-left duration-1000">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <span className="text-green-400 font-bold tracking-widest uppercase text-sm">
                GeoAI Analytics v3.0
              </span>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-extrabold tracking-tighter leading-none">
              Revolutionizing <span className="text-green-500">Food Security</span> in Kenya
            </h1>
            
            <p className="text-xl text-slate-300 leading-relaxed max-w-xl">
              Kenya Yield Insight combines Sentinel-2 satellite imagery with advanced Machine Learning to predict crop yields and track phenology in real-time.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button 
                onClick={onEnter}
                className="px-8 py-6 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(34,197,94,0.4)] text-base"
              >
                Launch Dashboard <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">What does the system do?</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              Our GeoAI engine processes satellite data to provide actionable insights for farmers and policy makers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <Sprout className="h-8 w-8 text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Phenology Tracking</h3>
              <p className="text-slate-600 text-sm">Monitor life cycles and detect drought stress using NDVI anomalies.</p>
            </div>
            <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <ChartIcon className="h-8 w-8 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Yield Prediction</h3>
              <p className="text-slate-600 text-sm">ML models predict crop performance before harvest based on environmental conditions.</p>
            </div>
            <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <MapIcon className="h-8 w-8 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Spatial Mapping</h3>
              <p className="text-slate-600 text-sm">Interact with pixel-level maps showing productivity across Kenya.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;