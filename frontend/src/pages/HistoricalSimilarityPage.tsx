import React, { useEffect, useState } from 'react';
import type { Cyclone, SimilarityResult } from '../types';
import { getSimilarCyclones } from '../api/historical';
import { History } from 'lucide-react';

interface HistoricalSimilarityPageProps {
  cyclone: Cyclone;
}

export const HistoricalSimilarityPage: React.FC<HistoricalSimilarityPageProps> = ({ cyclone }) => {
  const [similarResults, setSimilarResults] = useState<SimilarityResult[]>([]);

  useEffect(() => {
    getSimilarCyclones(cyclone.id).then((res) => {
      setSimilarResults(res);
    });
  }, [cyclone.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-extrabold text-white">Historical Cyclone Similarity Engine (KNN Analog)</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Nearest Neighbors search over 10,000+ IBTrACS historical track embeddings for {cyclone.name}
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold">
          Algorithm: Cosine Similarity / KNN (k=5)
        </div>
      </div>

      {/* Top 3 Historical Analog Storm Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {similarResults.map((item) => (
          <div
            key={item.rank}
            className="glass-panel p-5 rounded-2xl border border-gray-800 glass-panel-hover flex flex-col justify-between space-y-4"
          >
            <div>
              {/* Rank & Similarity Badge */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-md">
                  Rank #{item.rank} Match
                </span>
                <span className="text-xs font-extrabold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {(item.similarityScore * 100).toFixed(0)}% Similarity
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-1">
                {item.historicalCyclone.name} ({item.historicalCyclone.year})
              </h3>
              <p className="text-xs text-amber-400 font-semibold mb-3">
                Peak Category: {item.historicalCyclone.finalIntensity}
              </p>

              <div className="space-y-2 text-xs text-gray-300 bg-gray-900/60 p-3 rounded-xl border border-gray-800 mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Landfall Target:</span>
                  <span className="font-bold text-white">{item.historicalCyclone.finalLandfallLocation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Sustained Wind:</span>
                  <span className="font-mono text-amber-400 font-bold">{item.historicalCyclone.maxWindSpeedKmh} km/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Lowest Pressure:</span>
                  <span className="font-mono text-purple-300">{item.historicalCyclone.minPressureHpa} hPa</span>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed font-sans">
                {item.historicalCyclone.impactSummary}
              </p>
            </div>

            <div className="pt-2 border-t border-gray-800">
              <span className="text-[11px] text-gray-400 italic">
                * Based on trajectory curvature, pressure deficit decay, and seasonal SST profile.
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
