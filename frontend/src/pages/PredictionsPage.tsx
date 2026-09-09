import React, { useState } from 'react';
import type { Cyclone, Prediction } from '../types';
import { runPredictionPipeline } from '../api/predictions';
import { Navigation, Cpu, RefreshCw, Layers } from 'lucide-react';

interface PredictionsPageProps {
  cyclone: Cyclone;
  prediction: Prediction | null;
}

export const PredictionsPage: React.FC<PredictionsPageProps> = ({ cyclone, prediction: initialPrediction }) => {
  const [prediction, setPrediction] = useState<Prediction | null>(initialPrediction);
  const [loading, setLoading] = useState(false);
  const [activeHour, setActiveHour] = useState<number | null>(null);

  const handleRunPredict = async () => {
    setLoading(true);
    try {
      const res = await runPredictionPipeline(cyclone.id);
      setPrediction(res);
    } finally {
      setLoading(false);
    }
  };

  const trajectories = prediction?.trajectory || [];

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="solis-card p-6 rounded-[28px] bg-white/80 border border-white/90 flex flex-wrap justify-between items-center gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF5500]/10 border border-[#FF5500]/30 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-[#FF5500]" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#141414] tracking-tight font-heading">AI Trajectory & Intensity Forecast Engine</h1>
          </div>
          <p className="text-xs text-[#6C665F] mt-1 font-sans">
            Kalman Filter Kinematics (6-12h) + XGBoost Spatiotemporal Ensemble (24-72h) for <span className="text-[#FF5500] font-bold">{cyclone.name}</span>
          </p>
        </div>

        <button
          onClick={handleRunPredict}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#141414] hover:bg-[#33302B] text-white font-extrabold text-xs shadow-md transition-all disabled:opacity-50 font-heading"
        >
          <RefreshCw className={`w-4 h-4 text-[#FF5500] ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Running ML Ensemble...' : 'Re-Run Forecast Engine'}</span>
        </button>
      </div>

      {/* Model Overview Cards Quad */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="solis-card p-5 rounded-[24px] bg-white/80 border border-white/90 space-y-2 shadow-sm">
          <span className="text-xs text-[#6C665F] font-mono block uppercase font-bold">Forecast Model Version</span>
          <span className="text-xl font-extrabold text-[#141414] font-mono block">
            {prediction?.modelVersion || 'Kalman-XGBoost-v2.1'}
          </span>
          <p className="text-[11px] text-[#6C665F] leading-relaxed">
            Hybrid lag feature matrix combining atmospheric pressure gradients, SST, and sea-level wind shear.
          </p>
        </div>

        <div className="solis-card p-5 rounded-[24px] bg-white/80 border border-white/90 space-y-2 shadow-sm">
          <span className="text-xs text-[#6C665F] font-mono block uppercase font-bold">Predicted Intensity Trend</span>
          <span className="text-xl font-black text-[#FF5500] font-sans uppercase tracking-wider block font-heading">
            {prediction?.predictedIntensityTrend || 'INTENSIFY'}
          </span>
          <p className="text-[11px] text-[#C7D4DD] leading-relaxed">
            Atmospheric dynamics indicate continuous storm intensification over open ocean waters.
          </p>
        </div>

        <div className="solis-card p-5 rounded-[24px] bg-[#132C42]/90 border border-[#3A4E5A] space-y-2 shadow-xl">
          <span className="text-xs text-[#7C93A0] font-mono block uppercase">Ensemble Confidence Score</span>
          <span className="text-3xl font-black text-[#22C55E] font-mono block">
            {((prediction?.confidenceScore || 0.88) * 100).toFixed(0)}%
          </span>
          <p className="text-[11px] text-[#C7D4DD] leading-relaxed">
            Cross-validated spatial variance across 6-hour observation windows.
          </p>
        </div>
      </div>

      {/* Spatiotemporal Forecast Points Table */}
      <div className="solis-card p-6 rounded-[28px] bg-[#132C42]/90 border border-[#3A4E5A] space-y-4 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3A4E5A] pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#3FC7EA]" />
            <h3 className="font-extrabold text-[#F5F8FA] text-base">Multi-Horizon Spatial Trajectory Table</h3>
          </div>
          <span className="text-xs font-mono text-[#3FC7EA] bg-[#3FC7EA]/10 px-3 py-1 rounded-full border border-[#3FC7EA]/30 font-bold">
            Interactive Horizon Scrubber
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-[#C7D4DD]">
            <thead className="bg-[#0B1B2B]/80 text-[#7C93A0] font-mono uppercase">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">Forecast Horizon</th>
                <th className="px-4 py-3">Predicted Coordinates</th>
                <th className="px-4 py-3">Uncertainty Radius</th>
                <th className="px-4 py-3 rounded-r-xl">Kinematic Algorithm Engine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3A4E5A] font-mono">
              {trajectories.map((pt, idx) => {
                const isHovered = activeHour === pt.forecastHour;
                return (
                  <tr
                    key={idx}
                    onMouseEnter={() => setActiveHour(pt.forecastHour)}
                    onMouseLeave={() => setActiveHour(null)}
                    className={`transition-colors cursor-pointer ${
                      isHovered ? 'bg-[#1E3E58] text-[#F5F8FA]' : 'hover:bg-[#0B1B2B]/60'
                    }`}
                  >
                    <td className="px-4 py-3.5 font-bold text-[#3FC7EA]">+{pt.forecastHour} Hours</td>
                    <td className="px-4 py-3.5 text-[#F5F8FA] font-bold">{pt.lat}°N, {pt.long}°E</td>
                    <td className="px-4 py-3.5 text-[#E8C24A] font-bold">± {pt.confidenceRadiusKm} km</td>
                    <td className="px-4 py-3.5 text-[#7C93A0]">
                      {pt.forecastHour <= 12 ? 'Kalman State Extrapolator' : 'XGBoost Spatiotemporal Net'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Explanation Breakdown */}
      <div className="solis-card p-6 rounded-[24px] bg-[#132C42]/80 border border-[#3A4E5A] space-y-3 shadow-xl">
        <div className="flex items-center gap-2 text-[#3FC7EA]">
          <Cpu className="w-5 h-5" />
          <h3 className="font-extrabold text-base text-[#F5F8FA]">XGBoost Feature Importance Breakdown</h3>
        </div>

        <p className="text-xs text-[#C7D4DD] leading-relaxed font-sans">
          {prediction?.explanation || 'Sea surface temperature (>29.5°C) and low vertical wind shear in northern Arabian Sea support further intensification before potential landfall near Kutch.'}
        </p>
      </div>
    </div>
  );
};

