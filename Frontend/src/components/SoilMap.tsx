import { MapContainer, TileLayer, ImageOverlay, useMap, GeoJSON, ZoomControl } from 'react-leaflet';

import { API_BASE_URL } from "../config";
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { LatLngBoundsExpression } from 'leaflet';
import { Layers, Info, Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import axios from 'axios';

interface SoilMapProps {
  county: string;
  subcounty: string;
}

import countyGeometryData from '@/data/county_geometry.json';
const COUNTY_GEOMETRY: Record<string, { coords: [number, number]; bounds: LatLngBoundsExpression }> = countyGeometryData as any;

const MapController = ({ county, subcounty, isExpanded }: { county: string; subcounty: string, isExpanded: boolean }) => {
  const map = useMap();

  useEffect(() => {
    // Whenever expanded state changes, we must notify Leaflet so it recalculates its size
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [isExpanded, map]);

  useEffect(() => {
    const fetchBounds = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/bounds`, {
          params: { county, subcounty }
        });
        
        if (res.data && res.data.bounds) {
          map.fitBounds(res.data.bounds, { padding: [4, 4], animate: true, duration: 1.5 });
          return;
        }
      } catch (err) {
        console.error("Failed to fetch exact bounds from API", err);
      }
      
      // Fallback
      try {
        const defaultTarget = COUNTY_GEOMETRY[county] || COUNTY_GEOMETRY['Kenya'];
        if (defaultTarget?.bounds) {
            map.fitBounds(defaultTarget.bounds, { padding: [4, 4], animate: true, duration: 1.5 });
        } else {
            map.flyTo([-0.0236, 37.9062], 6, { animate: true, duration: 1.5 });
        }
      } catch (err) {
        console.error("Failed to fit fallback bounds", err);
      }
    };
    
    fetchBounds();
  }, [county, subcounty, map]);

  return null;
};

export const SoilMap = ({ county, subcounty }: SoilMapProps) => {
  const [opacity, setOpacity] = useState(0.85);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [eeLayer, setEeLayer] = useState<string>('composite');
  const [eeTileUrl, setEeTileUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchEeUrl = async () => {
      try {
        const res = await axios.post(`${API_BASE_URL}/api/ee-soil-tile-url`, {
          layer: eeLayer,
          county: county,
          subcounty: subcounty
        });
        if (res.data && res.data.url) {
          setEeTileUrl(res.data.url);
        }
      } catch (e) {
        console.error("Failed to fetch EE soil tile url", e);
        setEeTileUrl(null);
      }
    };
    fetchEeUrl();
  }, [eeLayer, county, subcounty]);
  
  return (
    <Card className={isExpanded 
      ? "fixed inset-[2%] md:inset-[5%] z-[9999] h-[96vh] md:h-[90vh] w-[96vw] md:w-[90vw] bg-slate-950 border-2 border-slate-700 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden" 
      : "relative w-full h-[400px] overflow-hidden shadow-soft border-slate-800 rounded-[2rem] group bg-slate-950"
    }>
      <MapContainer 
        center={[-0.0236, 37.9062]} 
        zoom={6} 
        style={{ height: '100%', width: '100%', background: '#020617' }}
        zoomControl={false}
      >
        <TileLayer 
            attribution='&copy; OpenStreetMap' 
            url={'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'} 
        />
        <ZoomControl position="topright" />

        
        {eeTileUrl && county && county !== "Kenya" && (
           <TileLayer 
             key={eeTileUrl}
             url={eeTileUrl}
             opacity={opacity}
             zIndex={400}
           />
        )}

        <MapController county={county} subcounty={subcounty} isExpanded={isExpanded} />
      </MapContainer>
      
      {/* TOP HUD: Location Context & Layer Selector */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 min-w-[280px]">
        <div className="bg-slate-900/95 backdrop-blur-md p-3 rounded-xl shadow-2xl border border-slate-700 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-lg shadow-inner">
                <Layers className="h-4 w-4 text-white" />
              </div>
              <div>
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                GeoAI Soil Surface
                <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full font-mono uppercase tracking-tighter">
                  30m Res
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {subcounty ? subcounty : county} | High Precision
              </p>
            </div>
            </div>
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-400 transition-colors"
              title={isExpanded ? "Minimize Map" : "Expand Map"}
            >
              {isExpanded ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </button>
          </div>
          
          <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
            <Filter className="h-3 w-3 text-slate-400" />
            <select 
              value={eeLayer} 
              onChange={(e) => setEeLayer(e.target.value)}
              className="bg-slate-800/80 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="composite">RGB Composite (Clay/Sand/SOC)</option>
              <option value="texture">Soil Texture (USDA)</option>
              <option value="ph">Soil pH</option>
              <option value="soc">Organic Carbon (SOC)</option>
              <option value="nitrogen">Total Nitrogen</option>
              <option value="clay">Clay Content (%)</option>
              <option value="sand">Sand Content (%)</option>
              <option value="cec">CEC (cmol/kg)</option>
            </select>
          </div>
        </div>
      </div>

      {/* OPACITY CONTROL */}
      <div className="absolute bottom-6 left-6 z-[1000] bg-slate-900/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-700 min-w-[200px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Surface Transparency</span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">{Math.round(opacity * 100)}%</span>
        </div>
        <input 
          type="range" min="0" max="1" step="0.05" 
          value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
      </div>

      {/* LEGEND */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-slate-900/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-700 min-w-[150px]">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-3 w-3 text-emerald-400" />
          <span className="text-[10px] font-black uppercase text-slate-300 tracking-tighter">
            Soil Property Gradient
          </span>
        </div>
        
        {eeLayer === 'composite' ? (
          <div className="space-y-1">
             <div className="flex items-center justify-between text-[10px] font-bold">
                 <span className="text-red-400">Red: Clay</span>
                 <span className="text-green-400">Green: Sand</span>
                 <span className="text-blue-400">Blue: Carbon</span>
             </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1 w-full mt-2">
            <div className="h-3 w-full rounded-sm" 
              style={{
                background: eeLayer === 'ph' ? 'linear-gradient(to right, red, yellow, green)' :
                            eeLayer === 'soc' ? 'linear-gradient(to right, white, brown)' :
                            eeLayer === 'nitrogen' ? 'linear-gradient(to right, white, purple)' :
                            eeLayer === 'clay' ? 'linear-gradient(to right, white, blue)' :
                            eeLayer === 'sand' ? 'linear-gradient(to right, white, orange)' :
                            eeLayer === 'cec' ? 'linear-gradient(to right, white, magenta)' :
                            eeLayer === 'texture' ? 'linear-gradient(to right, #d5c36b, #46d143, #ff005b)' : ''
              }}
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase mt-1">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-700 flex items-center gap-2 opacity-50">
          <Info className="h-3 w-3 text-slate-400" />
          <span className="text-[9px] font-medium leading-tight text-slate-400">
            iSDAsoil 30m via Earth Engine
          </span>
        </div>
      </div>
    </Card>
  );
};