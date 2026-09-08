import React, { useState } from 'react';
import type { AiAnalysisResult, Cyclone } from '../types';
import { analyzeSatelliteImage } from '../api/satellite';
import { Eye, Cpu, Flame, CheckCircle, RefreshCw } from 'lucide-react';

interface SatelliteAnalysisPageProps {
  cyclone: Cyclone;
}

export const SatelliteAnalysisPage: React.FC<SatelliteAnalysisPageProps> = ({ cyclone }) => {
  const [selectedChannel, setSelectedChannel] = useState<'VISIBLE' | 'INFRARED' | 'WATER_VAPOR'>('INFRARED');
  const [showGradcam, setShowGradcam] = useState(true);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>({
    cycloneId: cyclone.id,
    modelName: 'ResNet34-GradCAM-v1',
    cycloneDetected: true,
    eyeFormed: true,
    structureScore: 0.94,
    classification: 'Very Severe Cyclonic Storm',
    confidence: 0.92,
    gradcamImageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    generatedAt: new Date().toISOString()
  });

  const handleRunAnalysis = async () => {
    setLoading(true);
    try {
      const res = await analyzeSatelliteImage(cyclone.id, 'img-1');
      setAnalysisResult(res);
    } finally {
      setLoading(false);
    }
  };

  const sampleImages = {
    VISIBLE: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    INFRARED: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
    WATER_VAPOR: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Eye className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-extrabold text-white">AI Vision & Grad-CAM Analysis</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            ResNet Deep Learning Feature Extraction & Explainable Heatmap Visualizer for {cyclone.name}
          </p>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Running ResNet Model...' : 'Re-Run AI Vision Pipeline'}</span>
        </button>
      </div>

      {/* Main Grid: Frame Display + AI Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Satellite Imagery Frame & Canvas Overlay (2 columns wide) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Channel Selector Bar */}
          <div className="flex items-center justify-between glass-panel p-3 rounded-xl border border-gray-800">
            <div className="flex gap-2">
              {(['VISIBLE', 'INFRARED', 'WATER_VAPOR'] as const).map((channel) => (
                <button
                  key={channel}
                  onClick={() => setSelectedChannel(channel)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedChannel === channel
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {channel.replace('_', ' ')}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowGradcam(!showGradcam)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                showGradcam
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Grad-CAM Heatmap Overlay</span>
            </button>
          </div>

          {/* Image Canvas Display Frame */}
          <div className="relative rounded-2xl overflow-hidden border border-gray-800 glass-panel h-[480px] group flex items-center justify-center">
            <img
              src={sampleImages[selectedChannel]}
              alt="Satellite Channel Frame"
              className="w-full h-full object-cover"
            />

            {/* Grad-CAM Heatmap Simulated Overlay */}
            {showGradcam && (
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-900/40 via-red-500/30 to-amber-400/20 mix-blend-color-dodge pointer-events-none transition-all animate-pulse">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-red-400/80 rounded-full animate-ping pointer-events-none"></div>
              </div>
            )}

            {/* Overlay Info Badge */}
            <div className="absolute bottom-4 left-4 glass-panel px-4 py-2 rounded-xl border border-gray-700 text-xs flex items-center gap-3">
              <span className="text-gray-400 font-mono">Source: INSAT-3D / NOAA</span>
              <span className="text-indigo-400 font-bold font-mono">Channel: {selectedChannel}</span>
            </div>
          </div>
        </div>

        {/* AI Model Output Panel */}
        <div className="space-y-6">
          {/* Classification & Structure Score */}
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-white text-sm">PyTorch ResNet Classifier</h3>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs text-gray-400 block">Predicted Classification</span>
                <span className="text-lg font-black text-amber-400">
                  {analysisResult?.classification}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Classification Confidence</span>
                  <span className="font-mono text-indigo-300 font-bold">
                    {((analysisResult?.confidence || 0.92) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all"
                    style={{ width: `${(analysisResult?.confidence || 0.92) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">Convective Structure Score</span>
                  <span className="font-mono text-purple-300 font-bold">
                    {((analysisResult?.structureScore || 0.94) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all"
                    style={{ width: `${(analysisResult?.structureScore || 0.94) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Feature Detection Flags */}
          <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3">
            <h3 className="font-bold text-white text-sm">Visual Feature Diagnostics</h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/60 border border-gray-800">
                <span className="text-gray-300">Cyclone Eye Center Formed</span>
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <CheckCircle className="w-4 h-4" /> Formed
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/60 border border-gray-800">
                <span className="text-gray-300">Convective Bands Symmetry</span>
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <CheckCircle className="w-4 h-4" /> Symmetric
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-900/60 border border-gray-800">
                <span className="text-gray-300">Cloud Top Temperature</span>
                <span className="font-mono text-purple-300 font-bold">-72°C (Extremely Cold)</span>
              </div>
            </div>
          </div>

          {/* Grad-CAM Explainability Legend */}
          <div className="glass-panel p-5 rounded-2xl border border-purple-500/30 space-y-2">
            <h3 className="font-bold text-purple-300 text-xs uppercase tracking-wider">Grad-CAM Feature Importance</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Grad-CAM (Gradient-weighted Class Activation Mapping) highlights high-gradient cloud top regions (red/amber) that most heavily influenced the neural network's category classification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
