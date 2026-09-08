import { useEffect, useState } from 'react';
import type { Alert, Cyclone, SituationReport } from '../types';
import { getActiveAlerts, getSituationReport } from '../api/alerts';
import { AlertTriangle, ShieldAlert, FileText, Download, CheckCircle2, MapPin, RefreshCw } from 'lucide-react';

interface AlertsPageProps {
  cyclone: Cyclone;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ cyclone }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [report, setReport] = useState<SituationReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    getActiveAlerts().then(setAlerts);
    getSituationReport(cyclone.id).then(setReport);
  }, [cyclone.id]);

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    try {
      const res = await getSituationReport(cyclone.id);
      setReport(res);
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-gray-800 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <h1 className="text-2xl font-extrabold text-white">Disaster Advisories & AI Situation Report</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Automated Rule-Based Risk Alerts & LLM Emergency Operational Briefing for {cyclone.name}
          </p>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={loadingReport}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-red-500/30 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loadingReport ? 'animate-spin' : ''}`} />
          <span>{loadingReport ? 'Synthesizing AI Brief...' : 'Generate New AI Report'}</span>
        </button>
      </div>

      {/* Active Alerts List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <span>Active Coastal Advisories & Warnings</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="solis-card p-5 rounded-2xl border border-[#FF6B57]/50 bg-[#FF6B57]/10 space-y-3 relative overflow-hidden shadow-lg shadow-[#FF6B57]/10"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#F5F8FA] text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B57] animate-ping"></span>
                  {alert.cycloneName}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-md bg-[#FF6B57]/20 text-[#FF6B57] border border-[#FF6B57]/40 font-mono font-extrabold uppercase">
                  {alert.severity}
                </span>
              </div>

              <p className="text-xs text-[#C7D4DD] leading-relaxed font-sans">{alert.message}</p>

              <div className="pt-2 flex flex-wrap gap-1.5 items-center">
                <MapPin className="w-3.5 h-3.5 text-[#7C93A0]" />
                {alert.affectedRegions.map((region, idx) => (
                  <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-[#132C42] text-[#FF6B57] border border-[#3A4E5A]">
                    {region}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Situation Report Section */}
      {report && (
        <div className="glass-panel p-6 rounded-2xl border border-indigo-500/40 space-y-6">
          <div className="flex justify-between items-center border-b border-gray-800 pb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-400" />
              <div>
                <h2 className="text-lg font-bold text-white">AI Emergency Operational Brief</h2>
                <p className="text-xs text-gray-400">Generated at {new Date(report.generatedAt).toLocaleString()}</p>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold border border-gray-700 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
          </div>

          {/* Executive Summary */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Executive Summary</h3>
            <p className="text-xs text-gray-200 leading-relaxed bg-gray-900/60 p-4 rounded-xl border border-gray-800">
              {report.executiveSummary}
            </p>
          </div>

          {/* Key Threats & Recommended Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Key Threats */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">Key Hazards & Coastal Threats</h3>
              <div className="space-y-2">
                {report.keyThreats.map((threat, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{threat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Response Actions */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Recommended Emergency Response</h3>
              <div className="space-y-2">
                {report.recommendedActions.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Meteorological Synthesis */}
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">Multi-Modal AI Meteorological Synthesis</h3>
            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              {report.meteorologicalSynthesis}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
