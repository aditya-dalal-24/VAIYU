import React, { useState } from 'react';
import { Shield, Lock, KeyRound, Globe, Cpu, CheckCircle2, LogOut, Sliders, Check, History, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProfilePageProps {
  onNavigate: (tab: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { user, logout, loginWithOAuth } = useAuth();

  const [savedSuccess, setSavedSuccess] = useState(false);
  const selectedRole = user?.role || 'METEOROLOGIST';
  const [alertThreshold, setAlertThreshold] = useState('CAT3');
  const [particleDensity, setParticleDensity] = useState('BALANCED');

  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const auditLogs = [
    { id: 1, action: 'Grad-CAM Neural Eye Heatmap Generated', target: 'Cyclone Biparjoy', timestamp: '10m ago', status: 'SUCCESS' },
    { id: 2, action: 'Kalman-XGBoost +72h Trajectory Track Run', target: 'Cyclone Biparjoy', timestamp: '42m ago', status: 'SUCCESS' },
    { id: 3, action: 'OAuth 2.0 PKCE Session Re-Authenticated', target: user?.authProvider.toUpperCase() || 'IMD_SSO', timestamp: '2h ago', status: 'VERIFIED' },
    { id: 4, action: 'KNN Historical Storm Analog Dataset Query', target: 'Arabian Sea Basin', timestamp: '5h ago', status: 'SUCCESS' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="solis-card p-6 md:p-8 rounded-[28px] bg-white/80 backdrop-blur-xl border border-white/90 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-lg">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#FF5500]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center gap-5 z-10">
          <div className="relative group">
            <img
              src={user?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"}
              alt={user?.name || "Operator Avatar"}
              className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-[#FF5500] shadow-xl"
            />
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white" title="Active Command State"></div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#FF5500]/15 text-[#FF5500] border border-[#FF5500]/30">
                {user?.role || 'METEOROLOGIST'}
              </span>
              <span className="text-[10px] font-mono text-[#6C665F]">
                ID: {user?.id || 'usr-alkesh-01'}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#141414] tracking-tight">
              {user?.name || "Dr. Alkesh Sharma"}
            </h1>
            <p className="text-xs md:text-sm text-[#FF5500] font-mono font-semibold">
              {user?.title || "Lead Meteorological Officer"}
            </p>
            <p className="text-xs text-[#6C665F] mt-0.5">
              {user?.organization || "IMD Earth Command Hub"} • {user?.email || "alkesh.sharma@imd.gov.in"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10 w-full md:w-auto">
          <button
            onClick={() => onNavigate('login')}
            className="flex-1 md:flex-initial py-2.5 px-4 rounded-xl bg-[#FF5500] hover:bg-[#E04B00] text-white font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4 text-white" />
            <span>Switch Account</span>
          </button>

          <button
            onClick={logout}
            className="py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Security & OAuth Connections */}
        <div className="lg:col-span-1 space-y-6">
          {/* Security & Authentication Status Card */}
          <div className="solis-card p-6 rounded-[24px] bg-white/80 backdrop-blur-xl border border-white/90 space-y-4 shadow-lg">
            <div className="flex items-center gap-2 border-b border-[#E6DED4] pb-3">
              <Shield className="w-5 h-5 text-[#FF5500]" />
              <h2 className="font-extrabold text-[#141414] text-base">Security & Authentication</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-4 h-4 text-[#FF5500]" />
                  <div>
                    <span className="font-bold text-[#141414] block">Active Auth Provider</span>
                    <span className="text-[11px] font-mono text-[#FF5500] uppercase font-bold">
                      {user?.authProvider || 'IMD_SSO'}
                    </span>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>

              <div className="p-3 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold text-[#141414] block">TLS 1.3 Encryption</span>
                    <span className="text-[11px] text-[#6C665F]">Active E2E Tunnel</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold">SECURE</span>
              </div>

              <div className="p-3 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-[#6C665F]" />
                  <div>
                    <span className="font-bold text-[#141414] block">JWT Token Status</span>
                    <span className="text-[11px] font-mono text-[#6C665F]">Expires in 23h 40m</span>
                  </div>
                </div>
                <button
                  onClick={() => loginWithOAuth((user?.authProvider as any) || 'imd_sso')}
                  className="p-1.5 rounded-lg bg-[#E6DED4] hover:bg-[#D8CFC4] text-[#141414] transition-colors"
                  title="Refresh Auth Token"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Linked OAuth Providers Card */}
          <div className="solis-card p-6 rounded-[24px] bg-white/80 backdrop-blur-xl border border-white/90 space-y-4 shadow-lg">
            <div className="flex items-center gap-2 border-b border-[#E6DED4] pb-3">
              <Globe className="w-5 h-5 text-[#FF5500]" />
              <h2 className="font-extrabold text-[#141414] text-base">Linked Accounts</h2>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Google */}
              <div className="p-3 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.1-6.68-4.93H1.21v3.15C3.21 21.36 7.33 24 12 24z" />
                    <path fill="#FBBC05" d="M5.32 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.21C.44 8.12 0 9.99 0 12s.44 3.88 1.21 5.42l4.11-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.21 2.64 1.21 6.58l4.11 3.15c.94-2.83 3.57-4.98 6.68-4.98z" />
                  </svg>
                  <span className="font-bold text-[#141414]">Google SSO</span>
                </div>
                {user?.authProvider === 'google' ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FF5500]/15 text-[#FF5500] rounded font-bold">CONNECTED</span>
                ) : (
                  <button onClick={() => loginWithOAuth('google')} className="text-[11px] text-[#FF5500] hover:underline font-semibold">Connect</button>
                )}
              </div>

              {/* GitHub */}
              <div className="p-3 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 fill-current text-[#141414]" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span className="font-bold text-[#141414]">GitHub OAuth</span>
                </div>
                {user?.authProvider === 'github' ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FF5500]/15 text-[#FF5500] rounded font-bold">CONNECTED</span>
                ) : (
                  <button onClick={() => loginWithOAuth('github')} className="text-[11px] text-[#FF5500] hover:underline font-semibold">Connect</button>
                )}
              </div>

              {/* IMD Enterprise SSO */}
              <div className="p-3 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-[#FF5500]" />
                  <span className="font-bold text-[#141414]">IMD Enterprise SSO</span>
                </div>
                {user?.authProvider === 'imd_sso' ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#FF5500]/15 text-[#FF5500] rounded font-bold">PRIMARY</span>
                ) : (
                  <button onClick={() => loginWithOAuth('imd_sso')} className="text-[11px] text-[#FF5500] hover:underline font-semibold">Connect</button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Operational Preferences & Audit Logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Preferences Form Card */}
          <form onSubmit={handleSaveChanges} className="solis-card p-6 md:p-8 rounded-[24px] bg-white/80 backdrop-blur-xl border border-white/90 space-y-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E6DED4] pb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#FF5500]" />
                <h2 className="font-extrabold text-[#141414] text-base">Operational Telemetry & Map Preferences</h2>
              </div>
              {savedSuccess && (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fade-in">
                  <Check className="w-4 h-4" /> Preferences Saved!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Default Map Projection */}
              <div className="space-y-2">
                <label className="font-mono font-bold text-[#6C665F] uppercase tracking-wider block">
                  Default Globe Projection
                </label>
                <div className="flex">
                  <div className="w-full py-2.5 px-3 rounded-xl border text-xs font-bold bg-[#FF5500] text-white border-[#FF5500] text-center">
                    3D Orthographic (Default)
                  </div>
                </div>
              </div>

              {/* Wind Vector Particle Density */}
              <div className="space-y-2">
                <label className="font-mono font-bold text-[#6C665F] uppercase tracking-wider block">
                  Wind Particle Vector Density
                </label>
                <div className="flex gap-2">
                  {['LOW', 'BALANCED', 'MAX'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setParticleDensity(d)}
                      className={`flex-1 py-2.5 px-2 rounded-xl border text-xs font-bold transition-all ${
                        particleDensity === d
                          ? 'bg-[#FF5500]/15 text-[#FF5500] border-[#FF5500]'
                          : 'bg-[#F6F1E9] text-[#141414] border-[#E6DED4] hover:bg-[#E6DED4]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning Alert Filter Threshold */}
              <div className="space-y-2">
                <label className="font-mono font-bold text-[#6C665F] uppercase tracking-wider block">
                  Advisory Push Notification Filter
                </label>
                <select
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#F6F1E9] border border-[#E6DED4] text-[#141414] text-xs font-mono focus:border-[#FF5500] focus:outline-none"
                >
                  <option value="ALL">All Advisories & Warnings</option>
                  <option value="CAT2">Category 2+ Severe Cyclones</option>
                  <option value="CAT3">Category 3+ Very Severe Cyclones</option>
                  <option value="CAT5">Category 5 Extremely Severe Only</option>
                </select>
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="font-mono font-bold text-[#6C665F] uppercase tracking-wider block">
                  Assigned Operational Role
                </label>
                <input
                  type="text"
                  value={selectedRole}
                  disabled
                  className="w-full py-2.5 px-3 rounded-xl bg-[#E6DED4]/50 border border-[#E6DED4] text-[#6C665F] text-xs font-mono cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="py-3 px-6 rounded-xl bg-[#FF5500] hover:bg-[#E04B00] text-white font-extrabold text-xs shadow-lg transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-white" />
                <span>Save Operational Preferences</span>
              </button>
            </div>
          </form>

          {/* Audit Logs & System Action History */}
          <div className="solis-card p-6 md:p-8 rounded-[24px] bg-white/80 backdrop-blur-xl border border-white/90 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E6DED4] pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#FF5500]" />
                <h2 className="font-extrabold text-[#141414] text-base">Recent Operational Audit Trail</h2>
              </div>
              <span className="text-[11px] font-mono text-[#6C665F]">Session Node #8892</span>
            </div>

            <div className="space-y-2.5">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3.5 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-[#141414] block">{log.action}</span>
                    <span className="text-[11px] text-[#6C665F]">Target: <span className="font-mono text-[#FF5500] font-bold">{log.target}</span></span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold block mb-1">
                      {log.status}
                    </span>
                    <span className="text-[10px] text-[#6C665F]">{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
