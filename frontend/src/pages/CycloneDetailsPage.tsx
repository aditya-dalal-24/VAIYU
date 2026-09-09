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
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header Info Banner */}
      <div className="solis-card p-6 rounded-[28px] bg-white/80 backdrop-blur-xl border border-white/90 flex flex-wrap justify-between items-center gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-[#141414]">{cyclone.name}</h1>
            <span className="text-xs px-3 py-1 rounded-full bg-[#FF5500]/15 text-[#FF5500] font-bold border border-[#FF5500]/30 font-mono">
              {cyclone.basin} ({cyclone.seasonYear})
            </span>
          </div>
          <p className="text-xs text-[#6C665F] mt-1 font-mono">Telemetry Scenario ID: {cyclone.id}</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-xs text-[#6C665F] block font-mono">Intensity Category</span>
            <span className="text-lg font-extrabold text-amber-600">{latest?.intensityCategory || 'Very Severe'}</span>
          </div>
          <div className="text-right border-l border-[#E6DED4] pl-6">
            <span className="text-xs text-[#6C665F] block font-mono">Central Pressure</span>
            <span className="text-lg font-black font-mono text-[#FF5500]">{latest?.pressureHpa || 954} hPa</span>
          </div>
          <div className="text-right border-l border-[#E6DED4] pl-6">
            <span className="text-xs text-[#6C665F] block font-mono">Forward Speed</span>
            <span className="text-lg font-black font-mono text-[#FF5500]">{latest?.movementSpeedKmh || 14} km/h</span>
          </div>
        </div>
      </div>

      {/* Time-Series Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wind Speed Trend Chart */}
        <div className="solis-card p-6 rounded-[28px] bg-white/80 backdrop-blur-xl border border-white/90 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-[#FF5500]" />
              <h3 className="font-extrabold text-[#141414] text-base">Sustained Wind Speed Trend (km/h)</h3>
            </div>
            <span className="text-xs text-[#FF5500] font-mono font-bold">Peak: {latest?.windSpeedKmh} km/h</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="windGradSolis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF5500" stopOpacity={0.45}/>
                    <stop offset="95%" stopColor="#FF5500" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6DED4" />
                <XAxis dataKey="time" stroke="#6C665F" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6C665F" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141414', borderColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', color: '#FFFFFF' }}
                />
                <Area type="monotone" dataKey="windSpeed" stroke="#FF5500" strokeWidth={3} fillOpacity={1} fill="url(#windGradSolis)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Central Pressure Trend Chart */}
        <div className="solis-card p-6 rounded-[28px] bg-white/80 backdrop-blur-xl border border-white/90 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-[#FF5500]" />
              <h3 className="font-extrabold text-[#141414] text-base">Central Pressure Trend (hPa)</h3>
            </div>
            <span className="text-xs text-[#FF5500] font-mono font-bold">Lowest: {latest?.pressureHpa} hPa</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E6DED4" />
                <XAxis dataKey="time" stroke="#6C665F" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6C665F" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#141414', borderColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', color: '#FFFFFF' }}
                />
                <Line type="monotone" dataKey="pressure" stroke="#FF5500" strokeWidth={3} dot={{ r: 4, fill: '#FF5500' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Observation History Table */}
      <div className="solis-card p-6 rounded-[28px] bg-white/80 backdrop-blur-xl border border-white/90 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-[#E6DED4] pb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#FF5500]" />
            <h3 className="font-extrabold text-[#141414] text-base">Chronological Meteorological Telemetry Logs</h3>
          </div>
          <span className="text-xs font-mono text-[#6C665F]">{observations.length} Readings Recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-[#141414]">
            <thead className="bg-[#F6F1E9] text-[#6C665F] font-mono uppercase">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">Timestamp</th>
                <th className="px-4 py-3">Latitude / Longitude</th>
                <th className="px-4 py-3">Sustained Wind</th>
                <th className="px-4 py-3">Central Pressure</th>
                <th className="px-4 py-3 rounded-r-xl">Intensity Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DED4] font-mono">
              {observations.map((obs, idx) => (
                <tr key={idx} className="hover:bg-[#F6F1E9]/80 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-[#141414]">
                    {new Date(obs.observedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-[#FF5500] font-bold">{obs.lat}°N, {obs.long}°E</td>
                  <td className="px-4 py-3.5 text-amber-600 font-bold">{obs.windSpeedKmh} km/h</td>
                  <td className="px-4 py-3.5 text-[#FF5500] font-bold">{obs.pressureHpa} hPa</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F6F1E9] text-[#141414] border border-[#E6DED4] font-bold">
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

