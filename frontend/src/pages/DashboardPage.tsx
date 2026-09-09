import React, { useState } from 'react';
import type { Cyclone, Prediction, RiskAssessment, Alert } from '../types';
import { Sparkles, ArrowUpRight, MoreVertical, ChevronDown, Wind, FileText, Check } from 'lucide-react';

interface DashboardPageProps {
  cyclones: Cyclone[];
  selectedCyclone: Cyclone | null;
  setSelectedCyclone: (c: Cyclone) => void;
  prediction: Prediction | null;
  risk: RiskAssessment | null;
  alerts: Alert[];
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  cyclones,
  selectedCyclone,
  setSelectedCyclone,
  prediction: _prediction,
  risk,
  onNavigate,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('Jul');
  const latestObs = selectedCyclone?.latestObservation;

  // Dynamic monthly telemetry dataset based on storm
  const monthlyTelemetry = selectedCyclone?.basin === 'Bay of Bengal'
    ? [
        { month: 'Jan', val1: 55, val2: 30 },
        { month: 'Feb', val1: 70, val2: 40 },
        { month: 'Mar', val1: 65, val2: 35 },
        { month: 'Apr', val1: 85, val2: 50 },
        { month: 'May', val1: 120, val2: 80 },
        { month: 'Jun', val1: 95, val2: 60 },
        { month: 'Jul', val1: 135, val2: 90 },
        { month: 'Aug', val1: 80, val2: 45 },
        { month: 'Sep', val1: 100, val2: 55 },
        { month: 'Oct', val1: 110, val2: 70 },
        { month: 'Nov', val1: 45, val2: 20 },
        { month: 'Dec', val1: 80, val2: 40 },
      ]
    : [
        { month: 'Jan', val1: 45, val2: 25 },
        { month: 'Feb', val1: 60, val2: 30 },
        { month: 'Mar', val1: 50, val2: 20 },
        { month: 'Apr', val1: 75, val2: 35 },
        { month: 'May', val1: 40, val2: 15 },
        { month: 'Jun', val1: 90, val2: 55 },
        { month: 'Jul', val1: 110, val2: 70 },
        { month: 'Aug', val1: 65, val2: 30 },
        { month: 'Sep', val1: 85, val2: 45 },
        { month: 'Oct', val1: 95, val2: 50 },
        { month: 'Nov', val1: 30, val2: 15 },
        { month: 'Dec', val1: 70, val2: 35 },
      ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Active Storm Selector Bar */}
      <div className="solis-card p-4 flex flex-wrap items-center justify-between gap-4 border border-white/90 bg-white/75 rounded-[24px] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FF5500]/10 rounded-2xl text-[#FF5500] border border-[#FF5500]/30 shadow-sm">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-[#6E6860] font-mono block uppercase tracking-wider font-bold">Active Storm Scenario</span>
            <select
              value={selectedCyclone?.id || ''}
              onChange={(e) => {
                const found = cyclones.find((c) => c.id === e.target.value);
                if (found) setSelectedCyclone(found);
              }}
              className="bg-transparent font-extrabold text-xl text-[#1A1917] focus:outline-none cursor-pointer border-none font-sans"
            >
              {cyclones.map((c) => (
                <option key={c.id} value={c.id} className="bg-white text-[#1A1917]">
                  {c.name} — {c.basin} ({c.latestObservation?.windSpeedKmh || 165} km/h)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[11px] text-[#6E6860] font-mono block uppercase font-bold">Observation Baseline</span>
            <span className="text-sm font-bold text-[#FF5500] font-mono">
              {latestObs ? `${latestObs.lat.toFixed(2)}°N, ${latestObs.long.toFixed(2)}°E` : '20.50°N, 67.20°E'}
            </span>
          </div>
          <div className="h-8 w-[1px] bg-[#E6DED4]"></div>
          <div className="text-right">
            <span className="text-[11px] text-[#6E6860] font-mono block uppercase font-bold">Status</span>
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#FF5500]/15 text-[#FF5500] border border-[#FF5500]/40 font-mono">
              VERY SEVERE CYCLONIC
            </span>
          </div>
        </div>
      </div>

      {/* Top 2-Column Grid: Telemetry Chart & Threat Severity Index */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CARD 1: Top Left - Telemetry Chart */}
        <div className="lg:col-span-7 solis-card card-tone-telemetry p-6 flex flex-col justify-between rounded-[28px] shadow-lg bg-white/80 backdrop-blur-xl border border-white/90">
          <div>
            {/* Header Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 border-b border-[#E6DED4] pb-3">
              <div>
                <h2 className="text-xl font-black text-[#141414] tracking-tight font-heading flex items-center gap-2">
                  <span>Peak Wind Telemetry</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] font-bold">
                    km/h vs hPa
                  </span>
                </h2>
                <div className="flex items-center gap-4 text-xs text-[#6C665F] mt-1">
                  <span className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF5500]"></span>
                    <span>Max Wind Speed</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]"></span>
                    <span>Eye Pressure Index</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F6F1E9] text-xs text-[#141414] border border-[#E6DED4] hover:border-[#FF5500] transition-all font-mono font-bold">
                  <span>Season 2026</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button className="p-2 rounded-full bg-[#F6F1E9] text-[#141414] hover:text-[#FF5500] border border-[#E6DED4]">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Custom Dual-Tone Bar Chart with Smooth SVG Spline Overlay */}
            <div className="relative pt-10 pb-4 h-64 flex items-end justify-between gap-2 px-2 border-b border-[#E6DED4] overflow-visible">
              {/* Y-Axis Value Guides */}
              <div className="absolute top-0 left-0 text-[10px] font-mono text-[#6C665F] space-y-8 pointer-events-none z-0">
                <div>160 km/h</div>
                <div>120 km/h</div>
                <div>80 km/h</div>
                <div>40 km/h</div>
                <div>0 km/h</div>
              </div>

              {/* Bar Columns */}
              {monthlyTelemetry.map((item) => {
                const isSelected = item.month === selectedMonth;
                return (
                  <div
                    key={item.month}
                    onClick={() => setSelectedMonth(item.month)}
                    className="relative flex-1 flex flex-col items-center justify-end h-full group cursor-pointer z-20"
                  >
                    {/* Floating Tooltip Popover on Selected Bar */}
                    {isSelected && (
                      <div className="absolute -top-14 z-30 bg-[#141414] text-white text-[11px] font-semibold py-1.5 px-3 rounded-xl border border-white/20 shadow-2xl backdrop-blur-md animate-popover flex flex-col items-center pointer-events-none min-w-[110px]">
                        <span className="text-[10px] text-white/70 font-sans">{item.month}, 2026</span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-[#FF5500] font-bold">{item.val1} km/h</span>
                          <span className="text-white/40">|</span>
                          <span className="text-emerald-400 font-bold">{950 + (135 - item.val2)} hPa</span>
                        </div>
                        <div className="absolute bottom-0 translate-y-1/2 w-2 h-2 bg-[#141414] border-r border-b border-white/20 rotate-45"></div>
                      </div>
                    )}

                    {/* Outer Bar Container */}
                    <div
                      className={`w-full max-w-[28px] sm:max-w-[32px] rounded-t-xl rounded-b-md transition-all duration-300 relative overflow-hidden flex flex-col justify-end border ${
                        isSelected
                          ? 'bg-gradient-to-t from-[#FF5500]/90 via-[#FF5500]/70 to-[#FF5500]/20 border-[#FF5500] shadow-[0_0_20px_rgba(255,85,0,0.35)]'
                          : 'bg-[#E6DED4]/60 border-[#D8CFC4] group-hover:border-[#FF5500]/60 group-hover:bg-[#E6DED4]'
                      }`}
                      style={{ height: `${(item.val1 / 135) * 100}%` }}
                    >
                      {/* Top Cap Highlight Line */}
                      <div className={`h-[2px] w-full ${isSelected ? 'bg-amber-300 shadow-[0_0_8px_rgba(255,85,0,1)]' : 'bg-[#D8CFC4]'}`}></div>

                      {/* Dual-Tone Inner Bar Segment (Secondary Metric) */}
                      <div
                        className={`w-full rounded-b-md transition-all duration-300 border-t ${
                          isSelected
                            ? 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400 border-emerald-300 shadow-inner'
                            : 'bg-gradient-to-t from-emerald-800/80 via-emerald-700/60 to-emerald-600/40 border-emerald-600/30'
                        }`}
                        style={{ height: `${(item.val2 / item.val1) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Month Labels */}
            <div className="flex justify-between px-2 pt-3 text-[11px] font-medium text-[#6C665F]">
              {monthlyTelemetry.map((item) => (
                <span
                  key={item.month}
                  className={`cursor-pointer transition-all ${
                    item.month === selectedMonth
                      ? 'text-[#FF5500] font-bold bg-[#FF5500]/15 border border-[#FF5500]/30 px-2.5 py-0.5 rounded-lg shadow-sm'
                      : 'hover:text-[#141414] px-2.5 py-0.5'
                  }`}
                  onClick={() => setSelectedMonth(item.month)}
                >
                  {item.month}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 2: Top Right - Threat Metrics & Radial Arc Speedometer Gauge */}
        <div className="lg:col-span-5 solis-card card-tone-threat p-6 flex flex-col justify-between rounded-[28px] shadow-lg bg-white/80 backdrop-blur-xl border border-white/90">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3 border-b border-[#E6DED4] pb-2.5">
              <div>
                <h2 className="text-xl font-black text-[#141414] font-heading">Threat Severity Index</h2>
                <span className="text-[10px] font-mono text-[#6C665F]">Saffir-Simpson & IMD Risk Matrix</span>
              </div>
              <button
                onClick={() => onNavigate('predictions')}
                className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-[#FF5500] text-white hover:bg-[#E04B00] transition-all font-heading shadow-sm"
              >
                <span>View all</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* High-Precision SVG Semi-Circle Radial Speedometer Arc Gauge */}
            {(() => {
              const riskScoreVal = Math.round((risk?.riskScore || 0.73) * 100);
              const pctRatio = riskScoreVal / 100;
              const arcOffset = 125.6 * (1 - pctRatio);
              const angleRad = pctRatio * Math.PI;
              const dotX = (50 - 40 * Math.cos(angleRad)).toFixed(2);
              const dotY = (50 - 40 * Math.sin(angleRad)).toFixed(2);
              return (
                <div className="relative my-2 p-3 bg-[#F6F1E9]/80 rounded-2xl border border-[#E6DED4] flex items-center justify-between gap-4">
                  {/* Radial Arc Gauge SVG */}
                  <div className="relative w-28 h-16 shrink-0 flex items-center justify-center">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 55">
                      <defs>
                        <linearGradient id="threatArcGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#22C55E" />
                          <stop offset="50%" stopColor="#E8C24A" />
                          <stop offset="100%" stopColor="#FF5500" />
                        </linearGradient>
                      </defs>
                      {/* Background Arc */}
                      <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke="#E6DED4"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      {/* Active Arc */}
                      <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke="url(#threatArcGrad)"
                        strokeWidth="8.5"
                        strokeDasharray="125.6"
                        strokeDashoffset={arcOffset}
                        strokeLinecap="round"
                      />
                      {/* Dynamically Aligned Gauge Indicator Dot */}
                      <circle cx={dotX} cy={dotY} r="4" fill="#FF5500" stroke="#FFFFFF" strokeWidth="2" />
                    </svg>
                    <div className="absolute bottom-0 text-center">
                      <span className="text-xl font-black font-mono text-[#141414] leading-none block">{riskScoreVal}%</span>
                    </div>
                  </div>

                  {/* Main Stat Readings */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-[#141414] font-mono tracking-tight">
                        {latestObs ? latestObs.windSpeedKmh : '165'}
                      </span>
                      <span className="text-xs font-sans text-[#FF5500] font-bold">km/h peak</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#FF5500]/15 text-[#FF5500] border border-[#FF5500]/30">
                        {risk?.riskLevel ? `${risk.riskLevel} Risk` : 'Category 4 VSCS'}
                      </span>
                      <span className="text-[10px] font-mono text-[#FF5500] font-bold">↗ 4.7%</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Sub-Cards Side-by-Side: Functional Telemetry & Threat Metrics */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Sub-Card 1: Real-time Station Wind Telemetry Bars */}
              <div className="solis-subcard p-3 space-y-2 bg-[#F6F1E9]/80 border border-[#E6DED4] rounded-2xl">
                <div className="flex items-center justify-between border-b border-[#E6DED4] pb-1">
                  <span className="text-[10px] text-[#6C665F] font-mono font-bold uppercase tracking-wider">Stations</span>
                  <span className="text-[9px] font-mono text-[#FF5500] font-bold">3 Live</span>
                </div>

                <div className="space-y-1.5 text-[10px] font-mono">
                  <div>
                    <div className="flex justify-between text-[#141414] font-bold">
                      <span>Biparjoy Eye</span>
                      <span className="text-[#FF5500]">165 km/h</span>
                    </div>
                    <div className="w-full h-1 bg-[#E6DED4] rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-gradient-to-r from-[#FF5500] to-[#E04B00] rounded-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[#6C665F]">
                      <span>Kutch Outer</span>
                      <span className="text-[#FF5500] font-bold">142 km/h</span>
                    </div>
                    <div className="w-full h-1 bg-[#E6DED4] rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-[#FF5500] rounded-full" style={{ width: '78%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[#6C665F]">
                      <span>Muscat Buoy</span>
                      <span className="text-emerald-600 font-bold">110 km/h</span>
                    </div>
                    <div className="w-full h-1 bg-[#E6DED4] rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Card 2: Multi-Vector Threat Risk Meters */}
              <div className="solis-subcard p-3 space-y-2 bg-[#F6F1E9]/80 border border-[#E6DED4] rounded-2xl">
                <div className="flex items-center justify-between border-b border-[#E6DED4] pb-1">
                  <span className="text-[10px] text-[#6C665F] font-mono font-bold uppercase tracking-wider">Vectors</span>
                  <span className="text-[9px] font-mono text-[#FF5500] font-bold">High</span>
                </div>

                <div className="space-y-1.5 text-[10px] font-mono">
                  <div>
                    <div className="flex justify-between text-[#6C665F]">
                      <span>Wind Force</span>
                      <span className="text-[#FF5500] font-bold">92%</span>
                    </div>
                    <div className="w-full h-1 bg-[#E6DED4] rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-[#FF5500] rounded-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[#6C665F]">
                      <span>Surge (+3.8m)</span>
                      <span className="text-amber-600 font-bold">78%</span>
                    </div>
                    <div className="w-full h-1 bg-[#E6DED4] rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '78%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[#6C665F]">
                      <span>Flash Flood</span>
                      <span className="text-[#FF5500] font-bold">64%</span>
                    </div>
                    <div className="w-full h-1 bg-[#E6DED4] rounded-full overflow-hidden mt-0.5">
                      <div className="h-full bg-[#FF5500]/70 rounded-full" style={{ width: '64%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Bottom Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* CARD 3: Bottom Left - AI Orb Card */}
        <div className="md:col-span-4 solis-card card-tone-ai p-6 flex flex-col justify-between relative overflow-hidden rounded-[28px] shadow-lg bg-white/80 backdrop-blur-xl border border-white/90 space-y-4">
          {/* Header & Precision Pill */}
          <div className="flex items-center justify-between border-b border-[#E6DED4] pb-3">
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] font-bold uppercase tracking-wider">
              LLM-4o Synoptic Engine | 99.4%
            </span>
            <span className="text-[10px] font-mono text-[#6C665F]">UPD: 2m ago</span>
          </div>

          {/* Glowing 3D Solar Orb */}
          <div className="my-2 relative flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#FF5500] via-[#FF8800] to-[#FFAA00] flex items-center justify-center shadow-xl shadow-[#FF5500]/30 animate-pulse">
              <Sparkles className="w-9 h-9 text-white" />
            </div>
          </div>

          {/* Title & Detailed Scope Checklist */}
          <div className="space-y-3">
            <h3 className="text-base font-extrabold text-[#141414] leading-snug font-heading text-center">
              Automated AI Situation Reports
            </h3>

            {/* Rich Executive Summary Scope Details */}
            <div className="p-3 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] space-y-1.5 text-[11px] text-[#141414]">
              <div className="flex items-center gap-1.5 text-[#FF5500]">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-semibold">Eyewall Symmetry & Barometric Gradient</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#FF5500]">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-semibold">Coastal Inundation & Evacuation Priority</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-semibold">72h Kalman-XGBoost Trajectory Cone</span>
              </div>
            </div>

            {/* Format Selector Badges */}
            <div className="flex items-center justify-between text-[10px] font-mono text-[#6C665F] pt-1">
              <span>Export Formats:</span>
              <div className="flex gap-1">
                <span className="px-2 py-0.5 rounded bg-[#FF5500] text-white font-bold">PDF</span>
                <span className="px-2 py-0.5 rounded bg-[#F6F1E9] text-[#141414] border border-[#E6DED4] font-bold">JSON</span>
                <span className="px-2 py-0.5 rounded bg-[#F6F1E9] text-[#141414] border border-[#E6DED4] font-bold">CAP</span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('alerts')}
              className="w-full py-2.5 rounded-xl bg-[#141414] hover:bg-[#2A2825] text-white font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 font-heading"
            >
              <FileText className="w-4 h-4 text-white" />
              <span>Generate Executive Report</span>
            </button>
          </div>
        </div>

        {/* CARD 4: Middle - Basin Impact & Regional Telemetry */}
        <div className="md:col-span-4 solis-card p-6 flex flex-col justify-between relative overflow-hidden rounded-[28px] shadow-lg bg-white/80 backdrop-blur-xl border border-white/90">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 border-b border-[#E6DED4] pb-3">
            <div>
              <h3 className="text-base font-extrabold text-[#141414] font-heading">Basin Impact & Regional Telemetry</h3>
              <span className="text-[10px] font-mono text-[#6C665F]">6 Coastal Stations Tracking</span>
            </div>
            <button
              onClick={() => onNavigate('map')}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-[#F6F1E9] text-[#141414] hover:text-[#FF5500] border border-[#E6DED4] transition-all font-heading"
            >
              <span>Full Globe Map</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Detailed Expanded Regional Telemetry Grid */}
          <div className="space-y-2.5">
            {[
              { flag: '🇮🇳', country: 'India (Kutch Outer)', wind: '165 km/h', surge: 'Cat 3 Extreme', dist: '12 km to Eye', status: 'CRITICAL' },
              { flag: '🇴🇲', country: 'Oman (Muscat Outer)', wind: '120 km/h', surge: 'Outer Rainband', dist: '185 km to Eye', status: 'ALERT' },
              { flag: '🇵🇰', country: 'Pakistan (Karachi)', wind: '110 km/h', surge: 'High Storm Surge', dist: '140 km to Eye', status: 'WARNING' },
              { flag: '🇱🇰', country: 'Sri Lanka (Colombo)', wind: '85 km/h', surge: 'Moderate Swell', dist: '410 km to Eye', status: 'MONITOR' },
              { flag: '🇦🇪', country: 'UAE (Fujairah)', wind: '95 km/h', surge: 'Low Coast Impact', dist: '520 km to Eye', status: 'MONITOR' },
              { flag: '🇮🇷', country: 'Iran (Chabahar)', wind: '105 km/h', surge: 'Moderate Surge', dist: '320 km to Eye', status: 'WARNING' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] text-xs hover:border-[#FF5500]/40 transition-all">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{item.flag}</span>
                  <div>
                    <span className="font-bold text-[#141414] block leading-tight">{item.country}</span>
                    <span className="text-[10px] text-[#6C665F] font-mono">{item.dist} • {item.surge}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[#FF5500] font-bold block">{item.wind}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    item.status === 'CRITICAL' ? 'bg-[#FF5500]/15 text-[#FF5500]' : 'bg-[#141414]/10 text-[#141414]'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 5: Bottom Right - Hero Insight & Coastal Readiness Command Card */}
        <div className="md:col-span-4 solis-card card-tone-telemetry p-6 flex flex-col justify-between relative overflow-hidden rounded-[28px] shadow-lg bg-white/80 backdrop-blur-xl border border-white/90 space-y-4">
          {/* Large Hero Insight Statement & Status */}
          <div className="space-y-2 z-10">
            <div className="flex items-center justify-between border-b border-[#E6DED4] pb-2.5">
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#FF5500]/10 border border-[#FF5500]/30 text-[#FF5500] font-bold uppercase tracking-wider">
                Coastal Preparedness Matrix
              </span>
              <span className="text-[10px] font-mono text-[#6C665F]">Live Station Feed</span>
            </div>
            <h3 className="text-lg md:text-xl font-black text-[#141414] leading-tight font-heading pt-1">
              Cyclone intelligence is active — coastal readiness up by 84%.
            </h3>
          </div>

          {/* 3 Key Operational Readiness Metrics */}
          <div className="grid grid-cols-3 gap-2 z-10">
            <div className="p-2.5 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] text-center">
              <span className="text-[9px] font-mono text-[#6C665F] block uppercase">Resp. Time</span>
              <span className="text-sm font-black font-mono text-[#FF5500]">4.2m</span>
              <span className="text-[9px] font-mono text-emerald-600 block">↓ 32% fast</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] text-center">
              <span className="text-[9px] font-mono text-[#6C665F] block uppercase">NDRF Teams</span>
              <span className="text-sm font-black font-mono text-[#141414]">28 Active</span>
              <span className="text-[9px] font-mono text-[#FF5500] block">Kutch Zone</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] text-center">
              <span className="text-[9px] font-mono text-[#6C665F] block uppercase">Shelters</span>
              <span className="text-sm font-black font-mono text-emerald-600">94%</span>
              <span className="text-[9px] font-mono text-[#6C665F] block">142 Live</span>
            </div>
          </div>

          {/* Glowing Curve Area Sparkline Graphic with Labeled Milestones */}
          <div className="relative pt-2 h-28 w-full z-10">
            {/* Tooltip Popover */}
            <div className="absolute -top-3 right-0 bg-[#FF5500] text-white text-[10px] font-extrabold py-1 px-2.5 rounded-lg shadow-xl flex items-center gap-1.5 z-20 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              <span>Readiness: +84%</span>
            </div>

            {/* SVG Glowing Curve Line with Milestone Markers */}
            <svg className="w-full h-20 overflow-visible" viewBox="0 0 300 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="heroCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF5500" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#FF5500" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 65 Q 75 75 150 40 T 300 15 L 300 80 L 0 80 Z"
                fill="url(#heroCurveGrad)"
              />
              <path
                d="M 0 65 Q 75 75 150 40 T 300 15"
                fill="none"
                stroke="#FF5500"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Milestone Dots */}
              <circle cx="10" cy="64" r="4" fill="#F6F1E9" stroke="#FF5500" strokeWidth="2" />
              <circle cx="150" cy="40" r="4" fill="#F6F1E9" stroke="#FF5500" strokeWidth="2" />
              <circle cx="290" cy="15" r="5" fill="#FF5500" stroke="#FFFFFF" strokeWidth="2" />
            </svg>

            {/* Timeline X-Axis Labels */}
            <div className="flex items-center justify-between text-[9px] font-mono text-[#6C665F] pt-1 border-t border-[#E6DED4]">
              <span>00:00 (Alert)</span>
              <span>06:00</span>
              <span>12:00 (Evac)</span>
              <span>18:00</span>
              <span className="text-[#FF5500] font-bold">24:00 (Peak 84%)</span>
            </div>
          </div>

          {/* Action Button Row */}
          <div className="flex items-center gap-2 pt-1 z-10">
            <button
              onClick={() => onNavigate('map')}
              className="flex-1 py-2 px-3 rounded-xl bg-[#FF5500] hover:bg-[#E04B00] text-white font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-1.5 font-heading"
            >
              <span>Explore 3D Globe</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('alerts')}
              className="py-2 px-3 rounded-xl bg-[#F6F1E9] hover:bg-[#E6DED4] text-[#141414] border border-[#E6DED4] text-xs font-bold transition-all font-heading"
            >
              <span>Readiness Matrix</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
