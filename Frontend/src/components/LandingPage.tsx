import React, { useState } from 'react';
// Fixed the import error: Button usually comes from its own UI component
import { Button } from "@/components/ui/button"; 
import { 
  Brain, 
  Sprout, 
  LineChart as ChartIcon, 
  Map as MapIcon, 
  ChevronRight, 
  ShieldCheck,
  X,
  Lock
} from "lucide-react";
import heroImage from "@/assets/kenya-fields-hero.jpg";

interface LandingPageProps {
  onEnter: () => void;
}

const LandingPage = ({ onEnter }: LandingPageProps) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'anguzacynthia@gmail.com' && password === 'Cynthia@2014') {
      setError('');
      onEnter();
    } else {
      setError('Invalid email or password. Please try again.');
    }
  };

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
              {/* Trigger the login modal instead of directly entering */}
              <Button 
                onClick={() => setShowLoginModal(true)}
                className="px-8 py-6 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl font-bold transition-all flex items-center gap-2"
              >
                Explore Technology <ChevronRight className="h-5 w-5" />
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

      {/* Login Modal Overlay */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-md relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            
            <div className="mb-6">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 border border-green-500/30">
                <Lock className="h-6 w-6 text-green-400" />
              </div>
              <h2 className="text-2xl font-black text-white">System Access</h2>
              <p className="text-sm text-slate-400 mt-1">Please log in to access the GeoAI Analytics dashboard.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                  placeholder="Enter authorized email"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-400 font-bold">{error}</p>
                </div>
              )}

              <Button 
                type="submit"
                className="w-full py-6 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold mt-4 shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all"
              >
                Authenticate & Enter
              </Button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default LandingPage;