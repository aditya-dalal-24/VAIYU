import React from 'react';
import type { Cyclone, CycloneObservation } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import { Wind, Gauge, Database } from 'lucide-react';

interface CycloneDetailsPageProps {
  cyclone: Cyclone;
  observations: CycloneObservation[];
}

export const CycloneDetailsPage: React.FC<CycloneDetailsPageProps> = ({ cyclone, observations }) => {
  const chartData = observations.map((obs) => ({
    time: new Date(obs.observedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' }),
    windSpeed: obs.windSpeedKmh,
    pressure: obs.pressureHpa,
    category: obs.intensityCategory,
  }));

  const latest = cyclone.latestObservation;

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white">{cyclone.name}</h1>
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
              {cyclone.basin} ({cyclone.seasonYear})
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Telemetry ID: {cyclone.id}</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-xs text-gray-400 block">Intensity Category</span>
            <span className="text-lg font-black text-amber-400">{latest?.intensityCategory || 'Very Severe'}</span>
          </div>
          <div className="text-right border-l border-gray-800 pl-6">
            <span className="text-xs text-gray-400 block">Central Pressure</span>
            <span className="text-lg font-black font-mono text-purple-300">{latest?.pressureHpa || 954} hPa</span>
          </div>
          <div className="text-right border-l border-gray-800 pl-6">
            <span className="text-xs text-gray-400 block">Forward Movement</span>
            <span className="text-lg font-black font-mono text-indigo-300">{latest?.movementSpeedKmh || 14} km/h</span>
          </div>
        </div>
      </div>

      {/* Time-Series Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wind Speed Trend Chart */}
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-sm">Sustained Wind Speed Trend (km/h)</h3>
            </div>
            <span className="text-xs text-amber-400 font-mono font-bold">Peak: {latest?.windSpeedKmh} km/h</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#F3F4F6' }}
                />
                <Area type="monotone" dataKey="windSpeed" stroke="#F59E0B" strokeWidth={3} fillOpacity={1} fill="url(#windGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Central Pressure Trend Chart */}
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-purple-400" />
              <h3 className="font-bold text-white text-sm">Central Pressure Trend (hPa)</h3>
            </div>
            <span className="text-xs text-purple-300 font-mono font-bold">Lowest: {latest?.pressureHpa} hPa</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
                <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', color: '#F3F4F6' }}
                />
                <Line type="monotone" dataKey="pressure" stroke="#A855F7" strokeWidth={3} dot={{ r: 4, fill: '#A855F7' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Observation History Table */}
      <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-white text-sm">Chronological Meteorological Observations</h3>
          </div>
          <span className="text-xs text-gray-400">{observations.length} Observations Logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-300">
            <thead className="bg-gray-900/80 text-gray-400 font-mono uppercase">
              <tr>
                <th className="px-4 py-3 rounded-l-lg">Timestamp</th>
                <th className="px-4 py-3">Latitude / Longitude</th>
                <th className="px-4 py-3">Wind Speed</th>
                <th className="px-4 py-3">Central Pressure</th>
                <th className="px-4 py-3 rounded-r-lg">Intensity Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {observations.map((obs, idx) => (
                <tr key={idx} className="hover:bg-gray-800/40 transition-all font-mono">
                  <td className="px-4 py-3 font-semibold text-white">
                    {new Date(obs.observedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-indigo-300">{obs.lat}°N, {obs.long}°E</td>
                  <td className="px-4 py-3 text-amber-400 font-bold">{obs.windSpeedKmh} km/h</td>
                  <td className="px-4 py-3 text-purple-300">{obs.pressureHpa} hPa</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                      {obs.intensityCategory}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
