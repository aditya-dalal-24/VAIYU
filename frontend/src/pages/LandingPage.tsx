import React, { useState } from 'react';
import { ArrowRight, Wind, Activity, FileText, Navigation } from 'lucide-react';
import { Globe3DVisualizer } from '../components/map/Globe3DVisualizer';
import type { Cyclone, Prediction } from '../types';

interface LandingPageProps {
  cyclone?: Cyclone | null;
  prediction?: Prediction | null;
  onNavigate: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ cyclone, prediction, onNavigate }) => {
  const [activeTabSub, setActiveTabSub] = useState<'vectors' | 'precipitation'>('vectors');

  // Live animated cyclone telemetry metrics state
  const [metrics, setMetrics] = useState({
    windSpeed: 165,
    pressure: 954,
    surgeIndex: 78,
    eyeIntegrity: 92,
    tempC: 28
  });

  // Oscillate live metrics subtly for realistic cyclone telemetry feed animation
  React.useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        windSpeed: 163 + Math.floor(Math.random() * 5),
        pressure: 952 + Math.floor(Math.random() * 4),
        surgeIndex: 77 + Math.floor(Math.random() * 3),
        eyeIntegrity: 91 + Math.floor(Math.random() * 3),
        tempC: 28 + (Math.random() > 0.5 ? 1 : 0)
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-7xl mx-auto px-2 sm:px-4">
      {/* TOP HERO ROW: Active Cyclone Identifier & Live Pressure/Wind Telemetry Glass Pill Card */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pt-2 pb-2">
        {/* Active Cyclone Basin Identifier */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1 rounded-full bg-white/85 backdrop-blur-md border border-white/90 text-[#141414] text-[11px] font-mono font-bold tracking-wider uppercase shadow-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF5500] animate-ping"></span>
              ACTIVE CYCLONE
            </span>
            <span className="text-[11px] font-mono text-[#A39B8F] animate-pulse">UPD: live Doppler radar feed</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter font-heading uppercase drop-shadow-md leading-[0.95]">
            CYCLONE BIPARJOY / <br className="hidden sm:inline" />
            <span className="text-[#FF5500]">ARABIAN SEA</span>
          </h1>
        </div>

        {/* Floating Telemetry Glass Card (165 KM/H Max Wind | 954 HPA Pressure) */}
        <div className="solis-card px-6 py-4 rounded-2xl flex items-center gap-6 shadow-xl border border-white/90 bg-white/85 backdrop-blur-2xl transition-transform hover:scale-[1.01]">
          <div className="space-y-0.5 pr-6 border-r border-[#E0D8CD]">
            <div className="flex items-center gap-1.5 text-[#6C665F] text-[11px] font-mono uppercase font-bold">
              <Wind className="w-3.5 h-3.5 text-[#FF5500] animate-bounce-slow" />
              <span>Max Wind Speed</span>
            </div>
            <span className="text-3xl font-black font-mono text-[#141414] block leading-none transition-all">
              {metrics.windSpeed} <span className="text-xs font-semibold text-[#FF5500]">KM/H</span>
            </span>
          </div>

          <div className="space-y-0.5 pl-2">
            <div className="flex items-center gap-1.5 text-[#6C665F] text-[11px] font-mono uppercase font-bold">
              <Activity className="w-3.5 h-3.5 text-[#141414]" />
              <span>Central Pressure</span>
            </div>
            <span className="text-3xl font-black font-mono text-[#141414] block leading-none transition-all">
              {metrics.pressure} <span className="text-xs font-semibold text-[#6C665F]">HPA</span>
            </span>
          </div>
        </div>
      </div>

      {/* MAIN COCKPIT SECTION: FLOATING GLASS CARDS + 3D GLOBE CENTER */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* LEFT FLOATING GLASS CARD: Storm Intensity Orb */}
        <div className="xl:col-span-3 space-y-4">
          <div className="solis-card p-5 rounded-[24px] space-y-4 shadow-sm border border-white/90 bg-white/70 hover:shadow-md transition-all">
            <div className="flex items-center justify-between border-b border-[#E6DED4] pb-3">
              <div>
                <h3 className="font-extrabold text-[#1A1917] text-sm font-heading">Storm Intensity</h3>
                <span className="text-[10px] font-mono text-[#6E6860]">Category 4 • VSCS</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FF5500]/15 text-[#FF5500] rounded-full font-bold border border-[#FF5500]/30 animate-pulse">
                CRITICAL
              </span>
            </div>

            {/* Glowing Concentric Cyclonic Eye Wall Orb */}
            <div className="relative w-44 h-44 mx-auto flex items-center justify-center my-2 group">
              {/* Outer Dashed Vortex Orbit */}
              <div className="absolute inset-0 rounded-full border border-dashed border-[#FF5500]/40 animate-spin-slow"></div>
              
              {/* Glowing Cyclonic Eye Wall Flare Radial Gradient */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-[#FF5500] via-[#FF8800] to-[#FFAA00] opacity-80 blur-lg solar-halo-glow"></div>
              
              {/* Inner Eye Speed Circle */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FF5500] to-[#E64A00] flex flex-col items-center justify-center text-center shadow-xl relative z-10 group-hover:scale-105 transition-all duration-300 border border-white/40">
                <span className="text-xl font-black text-white font-mono leading-none transition-all">
                  {metrics.windSpeed}
                </span>
                <span className="text-[9px] font-mono text-white/90 uppercase font-bold tracking-wider mt-0.5">
                  KM/H WIND
                </span>
              </div>
              
              {/* Floating Pressure Pill Badge */}
              <div className="absolute top-1 left-1 bg-white/90 backdrop-blur-md text-[#1A1917] text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-white shadow-md transition-transform hover:scale-105">
                {metrics.pressure} hPa
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/60 border border-[#E6DED4] space-y-1">
              <div className="flex justify-between text-[11px] font-mono text-[#6E6860]">
                <span>Convective Core</span>
                <span className="text-[#FF5500] font-bold transition-all">{metrics.eyeIntegrity}%</span>
              </div>
              <div className="w-full bg-[#E6DED4] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#FF5500] h-full rounded-full transition-all duration-500" style={{ width: `${metrics.eyeIntegrity}%` }}></div>
              </div>
            </div>
          </div>

          {/* Quick Nav Button */}
          <button
            onClick={() => onNavigate('dashboard')}
            className="w-full py-3 px-4 rounded-2xl bg-[#1A1917] hover:bg-[#33302B] active:scale-[0.98] focus:ring-2 focus:ring-[#FF5500]/50 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 font-heading cursor-pointer"
          >
            <span>Launch Command Center</span>
            <ArrowRight className="w-4 h-4 text-[#FF5500]" />
          </button>
        </div>

        {/* CENTER COLUMN: 3D EARTH GLOBE VISUALIZER */}
        <div className="xl:col-span-6 space-y-4">
          <div className="solis-card card-tone-globe rounded-[28px] overflow-hidden shadow-2xl relative">
            <Globe3DVisualizer cyclone={cyclone || undefined} prediction={prediction || undefined} height="540px" />
          </div>
        </div>

        {/* RIGHT FLOATING GLASS CARD: Radar Storm Track Card */}
        <div className="xl:col-span-3 space-y-4">
          <div className="solis-card p-5 rounded-[24px] space-y-4 shadow-sm border border-white/90 bg-white/70 hover:shadow-md transition-all">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6DED4] pb-2.5">
              <h3 className="font-extrabold text-[#1A1917] text-sm font-heading flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-[#FF5500]" />
                <span>Radar Storm Track</span>
              </h3>
              <span className="text-[10px] font-mono text-[#6E6860] font-bold">INSAT-3D</span>
            </div>

            {/* Monochromatic Radar Path Wireframe Visual with Pins */}
            <div className="relative h-44 rounded-2xl bg-[#E8E2D9] overflow-hidden border border-[#DCD4C8] flex items-center justify-center">
              {/* Wireframe Trajectory Path Lines */}
              <svg className="w-full h-full opacity-60" viewBox="0 0 200 120" preserveAspectRatio="none">
                <path d="M0,100 Q50,40 100,70 T200,30 V120 H0 Z" fill="none" stroke="#7A7267" strokeWidth="1" strokeDasharray="3 2" />
                <path d="M0,110 Q60,60 120,90 T200,50 V120 H0 Z" fill="none" stroke="#5C554B" strokeWidth="1" />
                <path d="M0,80 Q40,30 90,50 T200,20 V120 H0 Z" fill="none" stroke="#A39B8F" strokeWidth="0.8" />
              </svg>

              {/* Storm Tracking Callout Pins: Eye Wall, Gujarat Coast, Landfall Zone */}
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-mono font-bold text-[#1A1917] border border-white shadow-sm flex items-center gap-1 hover:scale-105 transition-transform">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]"></span>
                Eye Wall
              </div>

              <div className="absolute bottom-6 left-12 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-mono font-bold text-[#1A1917] border border-white shadow-sm flex items-center gap-1 hover:scale-105 transition-transform">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1A1917]"></span>
                Gujarat Coast
              </div>

              <div className="absolute top-8 right-5 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-mono font-bold text-[#1A1917] border border-white shadow-sm flex items-center gap-1 hover:scale-105 transition-transform">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]"></span>
                Landfall Zone
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => onNavigate('map')}
              className="w-full py-2.5 rounded-xl bg-[#1A1917] hover:bg-[#33302B] active:scale-[0.98] text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 font-heading cursor-pointer"
            >
              <span>Analyze Trajectory AI</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#FF5500]" />
            </button>
          </div>

          {/* Bottom Card: Cyclonic Telemetry & Surge Threat Index */}
          {(() => {
            const pRatio = metrics.surgeIndex / 100;
            const strokeDashoffset = 125.66 * (1 - pRatio);
            const theta = Math.PI * (1 - pRatio);
            const dotX = 50 + 40 * Math.cos(theta);
            const dotY = 50 - 40 * Math.sin(theta);

            return (
              <div className="rounded-[20px] bg-[#3B291F]/90 backdrop-blur-md border border-white/25 overflow-hidden text-white shadow-xl p-4 space-y-3">
                <div className="grid grid-cols-2 border border-white/20 bg-white/10 p-3 rounded-2xl">
                  <div className="pr-3 border-r border-white/15">
                    <p className="text-[32px] sm:text-[34px] leading-none font-light font-mono text-white">
                      {metrics.pressure} <span className="text-[12px] align-top font-sans font-semibold text-white/80">hPa</span>
                    </p>
                    <p className="text-[10px] mt-1 text-white/70 uppercase font-mono font-bold">Pressure</p>
                  </div>
                  <div className="pl-3">
                    <p className="text-[32px] sm:text-[34px] leading-none font-light font-mono text-[#FF8800]">
                      {metrics.windSpeed} <span className="text-[12px] align-top font-sans font-semibold text-[#FF8800]/80">km/h</span>
                    </p>
                    <p className="text-[10px] mt-1 text-white/70 uppercase font-mono font-bold">Max Wind</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/10 border border-white/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[26px] font-light leading-none font-heading text-white">View</p>
                    <span className="text-white/50 font-mono">•••</span>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setActiveTabSub('vectors')}
                      className={`flex-1 rounded-full text-[10px] py-1.5 font-bold transition-all cursor-pointer ${
                        activeTabSub === 'vectors'
                          ? 'bg-[#FF5500] text-white shadow-sm'
                          : 'bg-white/15 text-white/80 hover:bg-white/30'
                      }`}
                    >
                      Wind Field
                    </button>

                    <button
                      onClick={() => setActiveTabSub('precipitation')}
                      className={`flex-1 rounded-full text-[10px] py-1.5 font-bold transition-all cursor-pointer ${
                        activeTabSub === 'precipitation'
                          ? 'bg-[#FF5500] text-white shadow-sm'
                          : 'bg-white/15 text-white/80 hover:bg-white/30'
                      }`}
                    >
                      Precipitation
                    </button>
                  </div>
                </div>

                {/* Storm Surge Threat Index Semi-Circle Gauge */}
                <div className="pt-2 space-y-2 border-t border-white/15">
                  <span className="text-xs font-mono font-bold text-white/90 block">Storm Surge Threat</span>
                  
                  <div className="relative w-full h-24 flex items-end justify-center">
                    <svg className="w-36 h-20" viewBox="0 0 100 55">
                      <defs>
                        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FF8800" />
                          <stop offset="100%" stopColor="#FF3300" />
                        </linearGradient>
                      </defs>
                      {/* Background Track */}
                      <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke="rgba(255,255,255,0.25)"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      {/* Active Fill Track */}
                      <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke="url(#gaugeGrad)"
                        strokeWidth="8"
                        strokeDasharray="125.66"
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                      />
                      {/* Precise Indicator Dot at exact math coordinates along arc */}
                      <circle
                        cx={dotX}
                        cy={dotY}
                        r="4"
                        fill="#FFFFFF"
                        stroke="#FF5500"
                        strokeWidth="2"
                        className="animate-pulse shadow-md"
                      />
                    </svg>

                    <div className="absolute bottom-1 text-center">
                      <span className="text-xl font-black text-white font-mono block tracking-tight drop-shadow-md">
                        {metrics.surgeIndex}%
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => onNavigate('alerts')}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#FF5500] hover:bg-[#E64A00] active:scale-[0.98] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 font-heading cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-white" />
                    <span>Generate Evacuation Advisory</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

