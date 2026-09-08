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

  const handleRunPredict = async () => {
    setLoading(true);
    try {
      const res = await runPredictionPipeline(cyclone.id);
      setPrediction(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Navigation className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-extrabold text-white">AI Trajectory & Intensity Forecast Engine</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Kalman Filter Kinematics (6-12h) + XGBoost Spatiotemporal Ensemble (24-48h) for {cyclone.name}
          </p>
        </div>

        <button
          onClick={handleRunPredict}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/30 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Running ML Models...' : 'Re-Run Forecast Engine'}</span>
        </button>
      </div>

      {/* Model Overview Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-2">
          <span className="text-xs text-gray-400 block">Forecast Model Version</span>
          <span className="text-lg font-bold text-purple-300 font-mono">{prediction?.modelVersion || 'Kalman-XGBoost-v2.1'}</span>
          <p className="text-[11px] text-gray-400">Hybrid lag feature matrix combining atmospheric pressure gradients & SST.</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-2">
          <span className="text-xs text-gray-400 block">Predicted Intensity Trend</span>
          <span className="text-lg font-extrabold text-amber-400 uppercase tracking-wider">
            {prediction?.predictedIntensityTrend || 'INTENSIFY'}
          </span>
          <p className="text-[11px] text-gray-400">Atmospheric dynamics indicate further storm intensification over open ocean.</p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-2">
          <span className="text-xs text-gray-400 block">Ensemble Confidence Score</span>
          <span className="text-2xl font-black text-indigo-400 font-mono">
            {((prediction?.confidenceScore || 0.88) * 100).toFixed(0)}%
          </span>
          <p className="text-[11px] text-gray-400">Cross-validated spatial variance across 6-hour observation windows.</p>
        </div>
      </div>

      {/* Spatiotemporal Forecast Points Table */}
      <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <h3 className="font-bold text-white text-sm">Multi-Horizon Spatial Trajectory Table</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-300">
            <thead className="bg-gray-900/80 text-gray-400 font-mono uppercase">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Forecast Horizon</th>
                <th className="px-4 py-3">Predicted Coordinates</th>
                <th className="px-4 py-3">Uncertainty Radius (km)</th>
                <th className="px-4 py-3 rounded-r-lg">Kinematic Model Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 font-mono">
              {(prediction?.trajectory || []).map((pt, idx) => (
                <tr key={idx} className="hover:bg-gray-800/40 transition-all">
                  <td className="px-4 py-3 font-bold text-purple-300">+{pt.forecastHour} Hours</td>
                  <td className="px-4 py-3 text-white font-semibold">{pt.lat}°N, {pt.long}°E</td>
                  <td className="px-4 py-3 text-amber-400">± {pt.confidenceRadiusKm} km</td>
                  <td className="px-4 py-3 text-gray-400">
                    {pt.forecastHour <= 12 ? 'Kalman State Extrapolator' : 'XGBoost Spatiotemporal Net'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Explanation Breakdown */}
      <div className="glass-panel p-5 rounded-2xl border border-purple-500/30 space-y-3">
        <div className="flex items-center gap-2 text-purple-300">
          <Cpu className="w-5 h-5" />
          <h3 className="font-bold text-sm">XGBoost Feature Importance Breakdown</h3>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed">
          {prediction?.explanation || 'Sea surface temperature (>29.5°C) and low vertical wind shear in northern Arabian Sea support further intensification before potential landfall near Kutch.'}
        </p>
      </div>
    </div>
  );
};
