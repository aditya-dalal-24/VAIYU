import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '../types';
import { loginWithOAuthProvider, getCurrentUserSession } from '../api/auth';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithOAuth: (provider: 'google' | 'github' | 'imd_sso') => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('cyclovision_auth_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const profile = await getCurrentUserSession();
        setUser(profile);
      } catch (err) {
        console.error('Failed restoring auth session', err);
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, []);

  const loginWithOAuth = async (provider: 'google' | 'github' | 'imd_sso') => {
    setLoading(true);
    try {
      const authRes = await loginWithOAuthProvider(provider);
      setUser(authRes.user);
      setToken(authRes.token);
      localStorage.setItem('cyclovision_auth_token', authRes.token);
      localStorage.setItem('cyclovision_user_profile', JSON.stringify(authRes.user));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('cyclovision_auth_token');
    localStorage.removeItem('cyclovision_user_profile');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        loading,
        loginWithOAuth,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
