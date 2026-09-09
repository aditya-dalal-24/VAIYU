import React, { useState } from 'react';
import { Shield, Lock, Globe, KeyRound, Eye, EyeOff, CheckCircle2, ArrowRight, UserCheck, Cpu, AlertCircle, User, Wind, Activity, Zap, Navigation } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Globe3DVisualizer } from '../components/map/Globe3DVisualizer';
import type { Cyclone } from '../types';

interface LoginPageProps {
  cyclone?: Cyclone | null;
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ cyclone, onLoginSuccess }) => {
  const { user, loginWithOAuth, loginWithCredentials, logout } = useAuth();
  
  const [authMode, setAuthMode] = useState<'sso' | 'credentials'>('sso');
  const [emailOrId, setEmailOrId] = useState('alkesh.sharma@imd.gov.in');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'METEOROLOGIST' | 'ADMIN' | 'ANALYST' | 'OBSERVER'>('METEOROLOGIST');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleOAuthSubmit = async (provider: 'google' | 'github' | 'imd_sso') => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await loginWithOAuth(provider);
      onLoginSuccess();
    } catch (err: any) {
      setAuthError('Authentication failed. Please verify network status or try another SSO provider.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrId) {
      setAuthError('Please enter your IMD Employee ID or official email address.');
      return;
    }
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await loginWithCredentials(emailOrId, password, selectedRole);
      onLoginSuccess();
    } catch (err: any) {
      setAuthError('Failed to authenticate credentials. Please check your credentials and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-100px)] w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-4 px-2 md:px-6 relative max-w-7xl mx-auto">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/3 left-1/4 w-[450px] h-[450px] bg-[#FF5500]/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-[#FF5500]/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* LEFT COLUMN: Live Operational Intelligence Showcase (7 Cols) */}
      <div className="lg:col-span-7 space-y-6 hidden lg:block">
        {/* Title Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FF5500]/15 border border-[#FF5500]/30 text-[#FF5500] text-xs font-mono font-bold uppercase tracking-wider shadow-sm">
            <Shield className="w-3.5 h-3.5 text-[#FF5500]" />
            <span>IMD Earth Emergency Operational Portal</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-[#141414] tracking-tight font-sans leading-tight">
            Secure Terminal for <span className="bg-gradient-to-r from-[#FF5500] via-[#FF8800] to-[#141414] bg-clip-text text-transparent">AI Cyclone Intelligence</span>
          </h1>

          <p className="text-xs md:text-sm text-[#6C665F] leading-relaxed max-w-xl">
            Real-time multi-modal early warning platform powered by ResNet-50 satellite vision, 72-hour Kalman-XGBoost track forecasting, and vector similarity search.
          </p>
        </div>

        {/* Live 3D Globe Feature Container */}
        <div className="solis-card rounded-[28px] p-4 bg-white/80 backdrop-blur-xl border border-white/90 space-y-3 shadow-lg relative overflow-hidden group">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="font-extrabold text-xs text-[#141414]">Live 3D Spherical Vector Field</span>
            </div>
            <span className="text-[11px] font-mono text-[#FF5500] bg-[#FF5500]/15 px-2.5 py-0.5 rounded-full border border-[#FF5500]/30 font-bold">
              North Indian Ocean Basin
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden border border-[#E6DED4] bg-[#121110]">
            <Globe3DVisualizer cyclone={cyclone || undefined} height="360px" />
          </div>

          {/* Quick Telemetry Ticker Strip */}
          <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
            <div className="p-2.5 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] flex items-center gap-2.5">
              <Wind className="w-4 h-4 text-[#FF5500]" />
              <div>
                <span className="text-[10px] text-[#6C665F] block">Peak Sustained</span>
                <span className="font-mono text-[#141414] font-bold">165 km/h</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-[#FF5500]" />
              <div>
                <span className="text-[10px] text-[#6C665F] block">Central Pressure</span>
                <span className="font-mono text-[#141414] font-bold">954 hPa</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F6F1E9]/80 border border-[#E6DED4] flex items-center gap-2.5">
              <Navigation className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-[10px] text-[#6C665F] block">72h Path Cone</span>
                <span className="font-mono text-emerald-700 font-bold">±150 km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security Compliance Strip */}
        <div className="flex items-center gap-6 text-xs text-[#6C665F] pt-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#FF5500]" />
            <span>TLS 1.3 End-to-End Encrypted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-[#6C665F]" />
            <span>OAuth 2.0 PKCE Flow</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-emerald-600" />
            <span>Sub-200ms Telemetry Pipeline</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Luxury Solis Glassmorphic Authentication Card (5 Cols) */}
      <div className="lg:col-span-5 w-full">
        <div className="solis-card p-6 md:p-8 border border-white/90 rounded-[32px] bg-white/85 backdrop-blur-2xl shadow-xl relative z-10 space-y-6 animate-popover">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#141414] mx-auto flex items-center justify-center shadow-xl border border-[#FF5500]/40">
              <Globe className="w-7 h-7 text-[#FF5500] animate-spin-slow font-extrabold" />
            </div>
            
            <h2 className="text-xl md:text-2xl font-black text-[#141414] tracking-tight">
              Operator Sign-In
            </h2>
            <p className="text-xs text-[#6C665F] max-w-xs mx-auto">
              Select your OAuth single sign-on provider or enter official IMD credentials
            </p>
          </div>

          {/* Currently Logged In Session Badge */}
          {user && (
            <div className="p-3.5 rounded-2xl bg-[#F6F1E9] border border-[#FF5500]/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#FF5500] shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-xs font-extrabold text-[#141414] block truncate">{user.name}</span>
                  <span className="text-[10px] font-mono text-[#FF5500] block truncate font-bold">
                    {user.role} • {user.authProvider.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={onLoginSuccess}
                  className="py-1.5 px-3 rounded-xl bg-[#FF5500] hover:bg-[#E04B00] text-white font-extrabold text-[11px] shadow-md transition-all flex items-center gap-1"
                >
                  <span>Dashboard</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  onClick={logout}
                  className="py-1.5 px-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold border border-red-200 transition-all"
                  title="Sign Out"
                >
                  Exit
                </button>
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="flex bg-[#F6F1E9] p-1.5 rounded-2xl border border-[#E6DED4]">
            <button
              type="button"
              onClick={() => setAuthMode('sso')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                authMode === 'sso'
                  ? 'bg-[#141414] text-white shadow-lg'
                  : 'text-[#6C665F] hover:text-[#141414]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>OAuth 2.0 SSO</span>
            </button>
            
            <button
              type="button"
              onClick={() => setAuthMode('credentials')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                authMode === 'credentials'
                  ? 'bg-[#141414] text-white shadow-lg'
                  : 'text-[#6C665F] hover:text-[#141414]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Credentials</span>
            </button>
          </div>

          {/* Error Notification */}
          {authError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* TAB 1: OAuth SSO Providers */}
          {authMode === 'sso' && (
            <div className="space-y-3 animate-fade-in">
              {/* Google OAuth */}
              <button
                onClick={() => handleOAuthSubmit('google')}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-[#F6F1E9] hover:bg-[#E6DED4] text-[#141414] border border-[#E6DED4] font-extrabold text-xs shadow-sm transition-all flex items-center justify-between group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.1-6.68-4.93H1.21v3.15C3.21 21.36 7.33 24 12 24z" />
                    <path fill="#FBBC05" d="M5.32 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.21C.44 8.12 0 9.99 0 12s.44 3.88 1.21 5.42l4.11-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.21 2.64 1.21 6.58l4.11 3.15c.94-2.83 3.57-4.98 6.68-4.98z" />
                  </svg>
                  <span>Sign in with Google Enterprise SSO</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[#6C665F] group-hover:translate-x-1 transition-transform" />
              </button>

              {/* GitHub OAuth */}
              <button
                onClick={() => handleOAuthSubmit('github')}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-[#F6F1E9] hover:bg-[#E6DED4] text-[#141414] border border-[#E6DED4] font-extrabold text-xs shadow-sm transition-all flex items-center justify-between group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 fill-current text-[#141414]" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>Sign in with GitHub Developer Account</span>
                </div>
                <ArrowRight className="w-4 h-4 text-[#6C665F] group-hover:translate-x-1 transition-transform" />
              </button>

              {/* IMD SSO */}
              <button
                onClick={() => handleOAuthSubmit('imd_sso')}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-[#FF5500] hover:bg-[#E04B00] text-white font-black text-xs shadow-lg transition-all flex items-center justify-between group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-white" />
                  <span>IMD Enterprise Operational SSO</span>
                </div>
                <Shield className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          {/* TAB 2: Standard Credentials */}
          {authMode === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit} className="space-y-3.5 animate-fade-in">
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-[#6C665F] uppercase tracking-wider block">
                  Select Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['METEOROLOGIST', 'ADMIN', 'ANALYST', 'OBSERVER'] as const).map((role) => {
                    const isSelected = selectedRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSelectedRole(role)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#FF5500]/15 border-[#FF5500] text-[#FF5500]'
                            : 'bg-[#F6F1E9] border-[#E6DED4] text-[#141414] hover:bg-[#E6DED4]'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{role}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-[#6C665F] uppercase tracking-wider block">
                  Employee ID / Official Email
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={emailOrId}
                    onChange={(e) => setEmailOrId(e.target.value)}
                    placeholder="e.g. alkesh.sharma@imd.gov.in"
                    required
                    className="w-full py-2.5 pl-9 pr-3 rounded-xl bg-[#F6F1E9] border border-[#E6DED4] text-[#141414] text-xs font-mono focus:border-[#FF5500] focus:outline-none transition-colors"
                  />
                  <User className="w-4 h-4 text-[#6C665F] absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-[#6C665F] uppercase tracking-wider block">
                  Security Passcode
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter passcode"
                    required
                    className="w-full py-2.5 pl-9 pr-9 rounded-xl bg-[#F6F1E9] border border-[#E6DED4] text-[#141414] text-xs font-mono focus:border-[#FF5500] focus:outline-none transition-colors"
                  />
                  <Lock className="w-4 h-4 text-[#6C665F] absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6C665F] hover:text-[#141414]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-[#FF5500] hover:bg-[#E04B00] text-white font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-white" />
                    <span>Authenticate Operator Session</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-[#E6DED4] text-center">
            <p className="text-[11px] text-[#6C665F]">
              CycloVision Operational System • TLS 1.3 E2E Security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
