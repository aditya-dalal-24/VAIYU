import React, { useState } from 'react';
import { Shield, Lock, X, CheckCircle2, ArrowRight, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface OAuthLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OAuthLoginModal: React.FC<OAuthLoginModalProps> = ({ isOpen, onClose }) => {
  const { loginWithOAuth, user } = useAuth();
  const [authenticatingProvider, setAuthenticatingProvider] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProviderLogin = async (provider: 'google' | 'github' | 'imd_sso') => {
    setAuthenticatingProvider(provider);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600)); // Smooth loading transition
      await loginWithOAuth(provider);
      onClose();
    } finally {
      setAuthenticatingProvider(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[#0B1B2B]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md solis-card p-6 border border-[#3A4E5A] rounded-[28px] bg-[#132C42]/95 shadow-2xl relative space-y-6 animate-popover">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full bg-[#1E3E58] text-[#C7D4DD] hover:text-[#F5F8FA] hover:bg-[#2C5872] border border-[#3A4E5A] transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#3FC7EA] to-[#2C5872] mx-auto flex items-center justify-center shadow-xl shadow-[#3FC7EA]/20">
            <Lock className="w-6 h-6 text-[#0B1B2B]" />
          </div>
          <h2 className="text-xl font-extrabold text-[#F5F8FA] tracking-tight">OAuth 2.0 Authentication</h2>
          <p className="text-xs text-[#C7D4DD] max-w-xs mx-auto">
            Single Sign-On (SSO) Portal for CycloVision Emergency Operational Intelligence
          </p>
        </div>

        {/* Currently Authenticated Operator Badge */}
        {user && (
          <div className="p-3 rounded-2xl bg-[#0B1B2B]/80 border border-[#3FC7EA]/40 flex items-center gap-3">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover border border-[#3FC7EA]"
            />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-[#F5F8FA] block truncate">{user.name}</span>
              <span className="text-[11px] text-[#3FC7EA] font-mono block truncate">
                Active Provider: {user.authProvider.toUpperCase()}
              </span>
            </div>
            <CheckCircle2 className="w-5 h-5 text-[#3FC7EA] shrink-0" />
          </div>
        )}

        {/* Provider Login Buttons */}
        <div className="space-y-3">
          {/* Google OAuth */}
          <button
            onClick={() => handleProviderLogin('google')}
            disabled={!!authenticatingProvider}
            className="w-full py-3 px-4 rounded-xl bg-[#F5F8FA] hover:bg-[#C7D4DD] text-[#0B1B2B] font-extrabold text-xs shadow-lg transition-all flex items-center justify-between group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.1-6.68-4.93H1.21v3.15C3.21 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.32 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.21C.44 8.12 0 9.99 0 12s.44 3.88 1.21 5.42l4.11-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.21 2.64 1.21 6.58l4.11 3.15c.94-2.83 3.57-4.98 6.68-4.98z"
                />
              </svg>
              <span>{authenticatingProvider === 'google' ? 'Authenticating with Google...' : 'Sign in with Google OAuth'}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#3A4E5A] group-hover:translate-x-1 transition-transform" />
          </button>

          {/* GitHub OAuth */}
          <button
            onClick={() => handleProviderLogin('github')}
            disabled={!!authenticatingProvider}
            className="w-full py-3 px-4 rounded-xl bg-[#1E3E58] hover:bg-[#2C5872] text-[#F5F8FA] border border-[#3A4E5A] font-bold text-xs shadow-md transition-all flex items-center justify-between group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 fill-current text-[#F5F8FA]" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>{authenticatingProvider === 'github' ? 'Authenticating with GitHub...' : 'Sign in with GitHub OAuth'}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#7C93A0] group-hover:translate-x-1 transition-transform" />
          </button>

          {/* IMD Enterprise SSO */}
          <button
            onClick={() => handleProviderLogin('imd_sso')}
            disabled={!!authenticatingProvider}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#3FC7EA] to-[#2C5872] hover:from-[#3FC7EA] hover:to-[#1E3E58] text-[#0B1B2B] font-extrabold text-xs shadow-lg transition-all flex items-center justify-between group disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-[#0B1B2B]" />
              <span>{authenticatingProvider === 'imd_sso' ? 'Connecting to IMD Network...' : 'IMD Enterprise SSO Login'}</span>
            </div>
            <Shield className="w-4 h-4 text-[#0B1B2B]" />
          </button>
        </div>

        {/* Footnote */}
        <div className="pt-2 border-t border-[#3A4E5A] text-center">
          <p className="text-[11px] text-[#7C93A0]">
            Encrypted with TLS 1.3 & OAuth 2.0 PKCE Flow
          </p>
        </div>
      </div>
    </div>
  );
};
