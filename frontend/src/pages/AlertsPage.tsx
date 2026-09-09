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
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');

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

  const filteredAlerts = (alerts || []).filter(a => {
    if (filterSeverity === 'ALL') return true;
    return a.severity?.toUpperCase() === filterSeverity;
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="solis-card p-6 rounded-[28px] bg-white/80 border border-white/90 flex flex-wrap justify-between items-center gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF5500]/10 border border-[#FF5500]/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#FF5500]" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#141414] tracking-tight font-heading">Disaster Advisories & AI Situation Brief</h1>
          </div>
          <p className="text-xs text-[#6C665F] mt-1 font-sans">
            Automated Rule-Based Coastal Warnings & Multi-Modal LLM Operational Synthesis for <span className="text-[#FF5500] font-bold">{cyclone?.name || 'Cyclone Biparjoy'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateReport}
            disabled={loadingReport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#141414] hover:bg-[#33302B] text-white font-extrabold text-xs shadow-md transition-all disabled:opacity-50 font-heading"
          >
            <RefreshCw className={`w-4 h-4 text-[#FF5500] ${loadingReport ? 'animate-spin' : ''}`} />
            <span>{loadingReport ? 'Synthesizing Brief...' : 'Re-Generate AI Report'}</span>
          </button>
        </div>
      </div>

      {/* Active Advisories Header & Severity Filter Pills */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-extrabold text-[#141414] flex items-center gap-2 font-heading">
            <ShieldAlert className="w-5 h-5 text-[#FF5500]" />
            <span>Active Coastal Advisories & Emergency Feeds</span>
          </h2>

          <div className="flex items-center gap-1 bg-white/60 p-1 rounded-full border border-white/90">
            {(['ALL', 'CRITICAL', 'WARNING'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
                  filterSeverity === sev ? 'bg-[#141414] text-white' : 'text-[#6C665F] hover:text-[#141414]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="solis-card p-5 rounded-[24px] border border-[#FF6B57]/40 bg-[#132C42]/90 space-y-3 relative overflow-hidden shadow-xl"
            >
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-[#F5F8FA] text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B57] animate-ping"></span>
                  {alert.cycloneName}
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#FF6B57]/20 text-[#FF6B57] border border-[#FF6B57]/40 font-mono font-bold uppercase">
                  {alert.severity}
                </span>
              </div>

              <p className="text-xs text-[#C7D4DD] leading-relaxed font-sans">{alert.message}</p>

              <div className="pt-2 flex flex-wrap gap-1.5 items-center">
                <MapPin className="w-3.5 h-3.5 text-[#7C93A0]" />
                {(alert.affectedRegions || []).map((region, idx) => (
                  <span key={idx} className="text-[11px] px-2.5 py-0.5 rounded-lg bg-[#0B1B2B] text-[#3FC7EA] border border-[#3A4E5A] font-mono">
                    {region}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Situation Report Section Card */}
      {report && (
        <div className="solis-card p-6 md:p-8 rounded-[28px] bg-[#132C42]/95 border border-[#3A4E5A] space-y-6 shadow-2xl">
          <div className="flex justify-between items-center border-b border-[#3A4E5A] pb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-[#3FC7EA]" />
              <div>
                <h2 className="text-lg font-extrabold text-[#F5F8FA]">AI Emergency Operational Brief</h2>
                <p className="text-xs text-[#7C93A0] font-mono">Generated at {new Date(report.generatedAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3E58] hover:bg-[#2C5872] text-[#F5F8FA] text-xs font-bold border border-[#3A4E5A] transition-all"
              >
                <Download className="w-4 h-4 text-[#3FC7EA]" />
                <span>Export Brief PDF</span>
              </button>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono font-bold text-[#3FC7EA] uppercase tracking-wider">Executive Summary</h3>
            <p className="text-xs text-[#F5F8FA] leading-relaxed bg-[#0B1B2B]/80 p-4 rounded-2xl border border-[#3A4E5A] font-sans">
              {report.executiveSummary}
            </p>
          </div>

          {/* Key Threats & Recommended Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Key Threats */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-mono font-bold text-[#FF6B57] uppercase tracking-wider">Key Hazards & Coastal Threats</h3>
              <div className="space-y-2">
                {(report.keyThreats || []).map((threat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FF6B57]/15 border border-[#FF6B57]/30 text-xs text-[#F5F8FA]">
                    <AlertTriangle className="w-4 h-4 text-[#FF6B57] shrink-0 mt-0.5" />
                    <span>{threat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Response Actions */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-mono font-bold text-[#22C55E] uppercase tracking-wider">Recommended Emergency Response</h3>
              <div className="space-y-2">
                {(report.recommendedActions || []).map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-xs text-[#F5F8FA]">
                    <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Meteorological Synthesis */}
          <div className="space-y-2 pt-2 border-t border-[#3A4E5A]">
            <h3 className="text-xs font-mono font-bold text-[#E8C24A] uppercase tracking-wider">Multi-Modal AI Meteorological Synthesis</h3>
            <p className="text-xs text-[#C7D4DD] leading-relaxed font-sans">
              {report.meteorologicalSynthesis}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

