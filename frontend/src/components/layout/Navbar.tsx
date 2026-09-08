import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Shield, Wind, Eye, Navigation, History, AlertTriangle, Globe, X, Check, Command, Cpu, Activity, ExternalLink, KeyRound, LogOut } from 'lucide-react';
import type { Cyclone } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { OAuthLoginModal } from '../auth/OAuthLoginModal';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  cyclones?: Cyclone[];
  onSelectCyclone?: (cyclone: Cyclone) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  activeTab, 
  setActiveTab, 
  cyclones = [],
  onSelectCyclone 
}) => {
  const { user, logout } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOAuthModalOpen, setIsOAuthModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnread, setHasUnread] = useState(true);
  const [readNotifications, setReadNotifications] = useState<number[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto focus input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  // Click outside listener to close drawers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: Shield },
    { id: 'map', label: 'Live 3D Globe', icon: Globe },
    { id: 'details', label: 'Telemetry', icon: Wind },
    { id: 'satellite', label: 'Grad-CAM Vision', icon: Eye },
    { id: 'predictions', label: 'Trajectory AI', icon: Navigation },
    { id: 'historical', label: 'Storm KNN', icon: History },
    { id: 'alerts', label: 'Advisories', icon: AlertTriangle },
  ];

  const notificationsList = [
    {
      id: 1,
      title: 'Cyclone Biparjoy Landfall Warning',
      time: '12m ago',
      category: 'CRITICAL',
      desc: 'Extremely severe winds (165 km/h) heading towards Kutch coastline.',
      tab: 'alerts'
    },
    {
      id: 2,
      title: 'ResNet Eye Structure Detected',
      time: '45m ago',
      category: 'VISION AI',
      desc: 'Symmetric convective eyewall formed with 94% neural confidence.',
      tab: 'satellite'
    },
    {
      id: 3,
      title: 'Kalman-XGBoost Cone Updated',
      time: '2h ago',
      category: 'FORECAST',
      desc: '+72h spatial track uncertainty radius refined to ±150 km.',
      tab: 'predictions'
    }
  ];

  const handleMarkAllRead = () => {
    setReadNotifications([1, 2, 3]);
    setHasUnread(false);
  };

  return (
    <header className="sticky top-0 z-50 pt-4 pb-2 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <div 
        ref={navContainerRef}
        className="solis-card px-6 py-3 flex items-center justify-between border border-[#3A4E5A] rounded-[24px] bg-[#0B1B2B]/90 backdrop-blur-2xl relative shadow-xl"
      >
        {/* Brand Name */}
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('dashboard')}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3FC7EA] to-[#2C5872] flex items-center justify-center shadow-lg shadow-[#3FC7EA]/20 group-hover:scale-105 transition-transform">
            <Globe className="w-4 h-4 text-[#0B1B2B] animate-spin-slow font-bold" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-[#F5F8FA] font-sans">
            CycloVision
          </span>
        </div>

        {/* Center Pill Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-[#132C42]/90 p-1.5 rounded-full border border-[#3A4E5A]">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-5 py-2 rounded-full text-xs font-medium transition-all duration-200 ${
                  isActive ? 'solis-pill-active' : 'solis-pill-inactive'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Search, Notifications, Avatar Profile */}
        <div className="flex items-center gap-3 relative">
          {/* Search Trigger Button */}
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="w-10 h-10 rounded-full bg-[#1E3E58] text-[#C7D4DD] hover:text-[#F5F8FA] hover:bg-[#2C5872] flex items-center justify-center transition-all border border-[#3A4E5A] shadow-sm relative group"
            title="Search storms or models (Ctrl+K)"
          >
            <Search className="w-4 h-4 text-[#C7D4DD] group-hover:text-[#F5F8FA] transition-colors" />
          </button>
          
          {/* Notifications Bell Trigger Button */}
          <button 
            onClick={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              setIsProfileOpen(false);
            }}
            className="w-10 h-10 rounded-full bg-[#1E3E58] text-[#C7D4DD] hover:text-[#F5F8FA] hover:bg-[#2C5872] flex items-center justify-center transition-all border border-[#3A4E5A] shadow-sm relative group"
            title="Real-time Advisories & Notifications"
          >
            <Bell className="w-4 h-4 text-[#C7D4DD] group-hover:text-[#F5F8FA] transition-colors" />
            {hasUnread && (
              <span className="absolute top-[6px] right-[6px] w-2.5 h-2.5 bg-[#3FC7EA] rounded-full border-2 border-[#0B1B2B] shadow-[0_0_8px_rgba(63,199,234,0.6)] animate-pulse"></span>
            )}
          </button>

          {/* User Profile Avatar Trigger Button */}
          <button 
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotificationsOpen(false);
            }}
            className="w-10 h-10 rounded-full overflow-hidden border border-[#3A4E5A] shadow-sm hover:border-[#3FC7EA] transition-all flex items-center justify-center bg-[#1E3E58] relative group focus:outline-none"
            title="Operator Profile & System Settings"
          >
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
              alt="Operator Avatar"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </button>

          {/* NOTIFICATIONS DROPDOWN DRAWER */}
          {isNotificationsOpen && (
            <div className="absolute top-14 right-0 w-80 sm:w-96 glass-panel rounded-2xl p-4 border border-gray-700/80 shadow-2xl z-50 space-y-3 bg-[#0F121A]/95 backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm">Disaster Advisories & Feeds</h3>
                </div>
                {hasUnread && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark read
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {notificationsList.map((item) => {
                  const isRead = readNotifications.includes(item.id);
                  return (
                    <div 
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.tab);
                        setIsNotificationsOpen(false);
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isRead 
                          ? 'bg-gray-900/40 border-gray-800 text-gray-400 opacity-60' 
                          : 'bg-gray-800/60 hover:bg-gray-800 border-gray-700 text-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                          item.category === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {item.category}
                        </span>
                        <span className="text-[10px] text-gray-400">{item.time}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white mb-0.5">{item.title}</h4>
                      <p className="text-[11px] text-gray-300 leading-snug">{item.desc}</p>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-gray-800 text-center">
                <button 
                  onClick={() => {
                    setActiveTab('alerts');
                    setIsNotificationsOpen(false);
                  }}
                  className="w-full py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <span>View All Regional Advisories</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* USER PROFILE POPOVER */}
          {isProfileOpen && (
            <div className="absolute top-14 right-0 w-80 glass-panel rounded-2xl p-4 border border-gray-700/80 shadow-2xl z-50 space-y-4 bg-[#0F121A]/95 backdrop-blur-2xl">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-800">
                <img
                  src={user?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"}
                  alt={user?.name || "Operator Avatar"}
                  className="w-12 h-12 rounded-full object-cover border border-emerald-500/40"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm truncate">{user?.name || "Dr. Alkesh Sharma"}</h3>
                  <p className="text-[11px] text-emerald-400 font-mono font-medium truncate">{user?.title || "Lead Meteorological Officer"}</p>
                  <span className="text-[10px] text-gray-400 truncate block">{user?.organization || "IMD Earth Command Hub"}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/60 border border-gray-800">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pipeline Uptime</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">99.8%</span>
                </div>

                <div className="flex justify-between items-center p-2 rounded-lg bg-gray-900/60 border border-gray-800">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    <span>OAuth Session</span>
                  </div>
                  <span className="font-mono text-indigo-300 font-bold uppercase">{user?.authProvider || 'IMD_SSO'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800 space-y-2">
                <button 
                  onClick={() => {
                    setIsOAuthModalOpen(true);
                    setIsProfileOpen(false);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Switch Account / OAuth SSO</span>
                </button>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      alert('Operational Diagnostics Log exported cleanly to session artifacts.');
                      setIsProfileOpen(false);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold text-gray-300 hover:bg-gray-800 hover:text-white border border-gray-800 transition-all flex items-center justify-center gap-1"
                  >
                    <span>Export Logs</span>
                    <ExternalLink className="w-3 h-3 text-gray-500" />
                  </button>

                  <button 
                    onClick={() => {
                      logout();
                      setIsOAuthModalOpen(true);
                      setIsProfileOpen(false);
                    }}
                    className="py-1.5 px-3 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all flex items-center gap-1"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* OAUTH 2.0 LOGIN MODAL */}
      <OAuthLoginModal isOpen={isOAuthModalOpen} onClose={() => setIsOAuthModalOpen(false)} />

      {/* SEARCH COMMAND PALETTE MODAL */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-start justify-center pt-20 px-4 animate-fade-in">
          <div className="w-full max-w-xl glass-panel rounded-2xl border border-gray-700 shadow-2xl overflow-hidden bg-[#0D101A] space-y-0">
            {/* Search Input Bar */}
            <div className="p-4 border-b border-gray-800 flex items-center gap-3 bg-gray-900/80">
              <Search className="w-5 h-5 text-emerald-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search active cyclones, tabs, models (e.g. Biparjoy, Grad-CAM, Trajectory)..."
                className="w-full bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
              />
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Navigation Results */}
            <div className="p-4 max-h-96 overflow-y-auto space-y-3 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                  Quick Navigation Shortcuts
                </span>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsSearchOpen(false);
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-900/60 hover:bg-emerald-500/10 hover:border-emerald-500/40 border border-gray-800 text-gray-200 hover:text-emerald-300 font-semibold transition-all text-left"
                    >
                      <item.icon className="w-4 h-4 text-emerald-400" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Cyclones Search Results */}
              {cyclones.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-gray-800">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                    Active Cyclone Scenarios
                  </span>
                  <div className="space-y-1.5 pt-1">
                    {cyclones
                      .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.basin.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            if (onSelectCyclone) onSelectCyclone(c);
                            setActiveTab('dashboard');
                            setIsSearchOpen(false);
                          }}
                          className="flex justify-between items-center p-2.5 rounded-xl bg-gray-900/40 hover:bg-gray-800 border border-gray-800/80 cursor-pointer transition-all"
                        >
                          <div>
                            <span className="font-bold text-white block">{c.name}</span>
                            <span className="text-[11px] text-gray-400">{c.basin} | Category: {c.latestObservation?.intensityCategory || 'Very Severe Cyclonic Storm'}</span>
                          </div>
                          <span className="font-mono text-emerald-400 font-bold">{c.latestObservation?.windSpeedKmh || 165} km/h</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer keyboard guide */}
            <div className="p-3 bg-gray-950 border-t border-gray-800 flex justify-between items-center text-[11px] text-gray-500 font-mono">
              <span className="flex items-center gap-1">
                <Command className="w-3 h-3" /> + K to open anytime
              </span>
              <span>Press ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

