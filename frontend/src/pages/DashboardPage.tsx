import React, { useState } from 'react';
import type { Cyclone, Prediction, RiskAssessment, Alert } from '../types';
import { Globe3DVisualizer } from '../components/map/Globe3DVisualizer';
import { Sparkles, ArrowUpRight, MoreVertical, ChevronDown, Wind } from 'lucide-react';

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
  prediction,
  risk,
  onNavigate,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('Jul');
  const latestObs = selectedCyclone?.latestObservation;

  // Dynamic regional impact list based on selected cyclone basin
  const regionalDistributors = selectedCyclone?.basin === 'Bay of Bengal'
    ? [
        { country: 'India (Odisha)', flag: '🇮🇳', value: '215 km/h' },
        { country: 'India (West Bengal)', flag: '🇮🇳', value: '195 km/h' },
        { country: 'Bangladesh (Khulna)', flag: '🇧🇩', value: '160 km/h' },
        { country: 'Myanmar (Rakhine)', flag: '🇲🇲', value: '110 km/h' },
      ]
    : [
        { country: 'India (Kutch)', flag: '🇮🇳', value: '165 km/h' },
        { country: 'Oman (Muscat)', flag: '🇴🇲', value: '120 km/h' },
        { country: 'Pakistan (Karachi)', flag: '🇵🇰', value: '110 km/h' },
        { country: 'Sri Lanka (Colombo)', flag: '🇱🇰', value: '85 km/h' },
      ];

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

  // Dot matrix pyramid grid dots for Card 2 sub-cards
  const dotPyramidLeft = [
    [0, 0, 0, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
  ];

  const dotPyramidRight = [
    [0, 0, 0, 'orange', 0, 0, 0],
    [0, 0, 'orange', 'red', 'orange', 0, 0],
    [0, 'emerald', 'orange', 'red', 'orange', 'emerald', 0],
    ['emerald', 'emerald', 'orange', 'red', 'orange', 'emerald', 'emerald'],
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 futuristic-grid-bg p-2 rounded-3xl">
      {/* Active Storm Selector Bar */}
      <div className="solis-card p-4 flex flex-wrap items-center justify-between gap-4 border border-[#3A4E5A] bg-[#1E3E58]/90">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#3FC7EA]/10 rounded-2xl text-[#3FC7EA] border border-[#3FC7EA]/30">
            <Wind className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <span className="text-[11px] text-[#7C93A0] font-mono block">Active Storm Scenario</span>
            <select
              value={selectedCyclone?.id || ''}
              onChange={(e) => {
                const found = cyclones.find((c) => c.id === e.target.value);
                if (found) setSelectedCyclone(found);
              }}
              className="bg-transparent font-extrabold text-xl text-[#F5F8FA] focus:outline-none cursor-pointer border-none"
            >
              {cyclones.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0B1B2B] text-[#F5F8FA]">
                  {c.name} — {c.basin} ({c.latestObservation?.windSpeedKph || 165} km/h)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-[#7C93A0] font-mono block">Basin Origin</span>
            <span className="text-sm font-bold text-[#3FC7EA] font-mono">{selectedCyclone?.basin}</span>
          </div>
          <div className="text-right border-l border-[#3A4E5A] pl-4">
            <span className="text-[11px] text-[#7C93A0] font-mono block">Central Pressure</span>
            <span className="text-sm font-bold text-[#E8C24A] font-mono">{latestObs?.pressureHpa || 954} hPa</span>
          </div>
        </div>
      </div>

      {/* 2-Column Top Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CARD 1: Top Left - Wind & Intensity Telemetry (Bar Chart matching Revenue Solis Card) */}
        <div className="lg:col-span-7 solis-card p-6 flex flex-col justify-between">
          <div>
            {/* Header with Title & Legend Pills */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-white tracking-tight">Telemetry</h2>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    Sustained Wind
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-emerald-400"></span>
                    Central Pressure
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1A1D28] text-xs text-gray-300 border border-white/10 hover:border-white/20 transition-all font-medium">
                  <span>Season 2026</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button className="p-2 rounded-full bg-[#1A1D28] text-gray-400 hover:text-white border border-white/10">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Custom Dual-Texture Bar Chart Visualizer */}
            <div className="relative pt-10 pb-4 h-64 flex items-end justify-between gap-2 px-2 border-b border-white/5">
              {/* Y-Axis Value Guides */}
              <div className="absolute top-0 left-0 text-[10px] font-mono text-gray-500 space-y-8 pointer-events-none">
                <div>160</div>
                <div>120</div>
                <div>80</div>
                <div>40</div>
                <div>0</div>
              </div>

              {/* Bar Columns */}
              {monthlyTelemetry.map((item) => {
                const isSelected = item.month === selectedMonth;
                return (
                  <div
                    key={item.month}
                    onClick={() => setSelectedMonth(item.month)}
                    className="relative flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                  >
                    {/* Floating Tooltip Popover on Selected Bar */}
                    {isSelected && (
                      <div className="absolute -top-12 z-20 bg-white text-gray-900 text-[11px] font-bold py-1.5 px-3 rounded-xl shadow-2xl animate-bounce flex flex-col items-center pointer-events-none min-w-[90px]">
                        <span>July, 2026</span>
                        <div className="text-[10px] text-emerald-700 font-mono">
                          <span>{latestObs?.windSpeedKph || 165} km/h</span>
                        </div>
                        <div className="absolute bottom-0 translate-y-1/2 w-2 h-2 bg-white rotate-45"></div>
                      </div>
                    )}

                    {/* Outer Bar Container */}
                    <div
                      className={`w-full max-w-[36px] rounded-2xl transition-all duration-300 relative overflow-hidden flex flex-col justify-end ${
                        isSelected
                          ? 'bg-gradient-to-t from-emerald-500 to-emerald-300 shadow-lg shadow-emerald-500/30'
                          : 'bg-[#1C202C] group-hover:bg-[#252A3A]'
                      }`}
                      style={{ height: `${(item.val1 / 135) * 100}%` }}
                    >
                      {/* Hatched Inner Bar Pattern */}
                      <div
                        className="w-full rounded-b-2xl hatched-bar-pattern bg-emerald-600/40"
                        style={{ height: `${(item.val2 / item.val1) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Month Labels */}
            <div className="flex justify-between px-2 pt-3 text-[11px] font-medium text-gray-400">
              {monthlyTelemetry.map((item) => (
                <span
                  key={item.month}
                  className={`cursor-pointer transition-all ${
                    item.month === selectedMonth
                      ? 'text-white font-bold bg-white/10 px-2 py-0.5 rounded-full'
                      : 'hover:text-gray-200'
                  }`}
                  onClick={() => setSelectedMonth(item.month)}
                >
                  {item.month}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CARD 2: Top Right - Threat Metrics & Active Risk (Total Profits Solis Card) */}
        <div className="lg:col-span-5 solis-card p-6 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Threat Severity Index</h2>
              <button
                onClick={() => onNavigate('predictions')}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
              >
                <span>View all</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Main Stat Number */}
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-4xl font-extrabold text-white font-mono tracking-tight">
                {latestObs ? latestObs.windSpeedKph : '165'} <span className="text-xl text-gray-400 font-sans">km/h</span>
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <span>↗ 4.7%</span>
              </span>
            </div>

            {/* Sub-Cards Side-by-Side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Sub-Card 1: Active Storms */}
              <div className="solis-subcard p-4 space-y-3">
                <span className="text-xs text-gray-400 font-medium block">Active Cyclones</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-white font-mono">{cyclones.length || 2} Storms</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                    ↗ 4.7%
                  </span>
                </div>
                <p className="text-[10px] text-emerald-400 font-mono">+{latestObs?.windSpeedKph || 165} km/h peak</p>

                {/* Dot Matrix Pyramid Grid Graphic */}
                <div className="pt-2 flex flex-col items-center gap-1">
                  {dotPyramidLeft.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-1.5">
                      {row.map((val, cIdx) => (
                        <div
                          key={cIdx}
                          className={`w-2 h-2 rounded-full transition-all ${
                            val === 1 ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-gray-800/40'
                          }`}
                        ></div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub-Card 2: Threat Severity Index */}
              <div className="solis-subcard p-4 space-y-3">
                <span className="text-xs text-gray-400 font-medium block">Threat Level</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-amber-400 font-mono">
                    {((risk?.riskScore || 0.82) * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                    ↘ 4.7%
                  </span>
                </div>
                <p className="text-[10px] text-rose-400 font-mono">{risk?.riskLevel || 'High'} risk warning</p>

                {/* Dot Matrix Multi-color Pyramid Grid Graphic */}
                <div className="pt-2 flex flex-col items-center gap-1">
                  {dotPyramidRight.map((row, rIdx) => (
                    <div key={rIdx} className="flex gap-1.5">
                      {row.map((color, cIdx) => (
                        <div
                          key={cIdx}
                          className={`w-2 h-2 rounded-full transition-all ${
                            color === 'emerald' ? 'bg-emerald-400' :
                            color === 'orange' ? 'bg-amber-400' :
                            color === 'red' ? 'bg-rose-500 shadow-sm shadow-rose-500' :
                            'bg-gray-800/40'
                          }`}
                        ></div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Bottom Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* CARD 3: Bottom Left - AI Orb Card ("AI-generated report in a few seconds") */}
        <div className="md:col-span-3 solis-card p-6 flex flex-col items-center justify-between text-center relative overflow-hidden dot-matrix-bg">
          {/* Glowing 3D Emerald Orb */}
          <div className="my-6 relative flex items-center justify-center">
            <div className="w-28 h-28 rounded-full emerald-orb-glow flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>

          {/* Text Statement */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white leading-snug">
              AI-generated report in a few seconds
            </h3>
            
            <button
              onClick={() => onNavigate('alerts')}
              className="w-full py-3 px-6 rounded-full bg-white text-gray-950 font-bold text-xs hover:bg-gray-100 transition-all shadow-xl hover:shadow-2xl"
            >
              Create Now
            </button>
          </div>
        </div>

        {/* CARD 4: Bottom Center - Interactive 3D Globe & Basin Risk Distribution */}
        <div className="md:col-span-5 solis-card p-6 flex flex-col justify-between relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 z-10">
            <h3 className="text-lg font-bold text-white">Basin Impact & 3D Globe</h3>
            <button
              onClick={() => onNavigate('map')}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
            >
              <span>See more</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Embedded Interactive 3D Globe Visualizer */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10 h-64 mb-4">
            <Globe3DVisualizer cyclone={selectedCyclone!} prediction={prediction || undefined} height="100%" />
          </div>

          {/* Regional Risk Distribution Overlay List */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {regionalDistributors.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-[#1B1E29]/70 border border-white/5">
                <span className="flex items-center gap-1.5 text-gray-300">
                  <span>{item.flag}</span>
                  <span className="truncate max-w-[90px]">{item.country}</span>
                </span>
                <span className="font-mono text-amber-400 font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 5: Bottom Right - Hero Insight & Curve Sparkline */}
        <div className="md:col-span-4 solis-card p-6 flex flex-col justify-between relative overflow-hidden">
          {/* Large Hero Insight Statement */}
          <div className="space-y-4 z-10">
            <h3 className="text-2xl font-bold text-white leading-tight">
              Your cyclone intelligence is active this season - coastal readiness up by 84%.
            </h3>
          </div>

          {/* Glowing Green Curve Area Sparkline Graphic with Tooltip Popover */}
          <div className="relative mt-8 pt-10 h-36 w-full">
            {/* Tooltip Popover */}
            <div className="absolute top-2 right-4 bg-white text-gray-900 text-[10px] font-bold py-1 px-2.5 rounded-lg shadow-xl flex items-center gap-1.5 z-20">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Readiness: +84%</span>
            </div>

            {/* SVG Glowing Curve Line */}
            <svg className="w-full h-full overflow-visible" viewBox="0 0 300 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="heroCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 80 Q 75 90 150 50 T 300 20 L 300 100 L 0 100 Z"
                fill="url(#heroCurveGrad)"
              />
              <path
                d="M 0 80 Q 75 90 150 50 T 300 20"
                fill="none"
                stroke="#4ADE80"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Floating Action Pill */}
          <div className="pt-2 z-10">
            <button
              onClick={() => onNavigate('details')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1B1E29]/80 text-gray-300 hover:text-white border border-white/10 text-xs font-semibold transition-all"
            >
              <span>Overview</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
