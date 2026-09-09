import React, { useEffect, useState } from 'react';
import type { Cyclone, SimilarityResult } from '../types';
import { getSimilarCyclones } from '../api/historical';
import { History, Sparkles } from 'lucide-react';

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
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="solis-card p-6 rounded-[28px] bg-white/80 backdrop-blur-xl border border-white/90 flex flex-wrap justify-between items-center gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF5500]/15 border border-[#FF5500]/30 flex items-center justify-center">
              <History className="w-4 h-4 text-[#FF5500]" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#141414] tracking-tight">Historical Cyclone Similarity Engine (KNN Analog)</h1>
          </div>
          <p className="text-xs text-[#6C665F] mt-1 font-sans">
            Nearest Neighbors vector search over 10,000+ IBTrACS historical storm track embeddings for <span className="text-[#FF5500] font-bold">{cyclone.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#FF5500]/15 border border-[#FF5500]/30 text-[#FF5500] text-xs font-mono font-bold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>KNN Embeddings (k=5)</span>
        </div>
      </div>

      {/* Top Historical Analog Storm Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {similarResults.map((item) => (
          <div
            key={item.rank}
            className="solis-card p-6 rounded-[24px] bg-white/80 backdrop-blur-xl border border-white/90 hover:border-[#FF5500] transition-all flex flex-col justify-between space-y-4 shadow-lg"
          >
            <div>
              {/* Rank & Similarity Badge */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold font-mono px-3 py-1 rounded-full bg-[#FF5500] text-white shadow-md font-extrabold">
                  Rank #{item.rank} Match
                </span>
                <span className="text-xs font-extrabold font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {(item.similarityScore * 100).toFixed(0)}% Similarity
                </span>
              </div>

              <h3 className="text-xl font-extrabold text-[#141414] mb-1">
                {item.historicalCyclone.name} ({item.historicalCyclone.year})
              </h3>
              <p className="text-xs text-amber-600 font-bold mb-3 font-mono">
                Peak Category: {item.historicalCyclone.finalIntensity}
              </p>

              <div className="space-y-2 text-xs text-[#141414] bg-[#F6F1E9]/80 p-3.5 rounded-2xl border border-[#E6DED4] mb-3 font-mono">
                <div className="flex justify-between">
                  <span className="text-[#6C665F]">Landfall Target:</span>
                  <span className="font-bold text-[#141414]">{item.historicalCyclone.finalLandfallLocation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6C665F]">Max Wind Speed:</span>
                  <span className="font-bold text-amber-600">{item.historicalCyclone.maxWindSpeedKmh} km/h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6C665F]">Min Pressure:</span>
                  <span className="font-bold text-[#FF5500]">{item.historicalCyclone.minPressureHpa} hPa</span>
                </div>
              </div>

              <p className="text-xs text-[#6C665F] leading-relaxed font-sans">
                {item.historicalCyclone.impactSummary}
              </p>
            </div>

            <div className="pt-2 border-t border-[#E6DED4]">
              <span className="text-[11px] text-[#6C665F] italic">
                * Based on trajectory curvature, pressure deficit decay, and seasonal SST profile.
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

