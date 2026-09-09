import axios from 'axios';
import type { UserProfile, AuthResponse } from '../types';

const API_BASE_URL = 'http://localhost:8080/api/v1/auth';

const DEFAULT_OPERATOR: UserProfile = {
  id: 'usr-alkesh-01',
  name: 'Dr. Alkesh Sharma',
  email: 'alkesh.sharma@imd.gov.in',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
  role: 'METEOROLOGIST',
  title: 'Lead Meteorological Officer',
  organization: 'IMD Earth Command Hub',
  authProvider: 'imd_sso'
};

export async function loginWithOAuthProvider(
  provider: 'google' | 'github' | 'imd_sso',
  authCode?: string
): Promise<AuthResponse> {
  try {
    const res = await axios.post(`${API_BASE_URL}/oauth/${provider}`, { code: authCode });
    return res.data;
  } catch (err) {
    console.warn(`Backend OAuth endpoint unavailable, resolving fallback ${provider} authentication profile`);
    
    let mockProfile: UserProfile = { ...DEFAULT_OPERATOR, authProvider: provider };
    
    if (provider === 'google') {
      mockProfile = {
        id: 'usr-google-889',
        name: 'Dr. Alkesh Sharma (Google SSO)',
        email: 'alkesh.sharma@gmail.com',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        role: 'METEOROLOGIST',
        title: 'Lead Meteorological Officer',
        organization: 'IMD Earth Command Hub',
        authProvider: 'google'
      };
    } else if (provider === 'github') {
      mockProfile = {
        id: 'usr-github-[#2502]',
        name: 'Jay Gajjar (GitHub OAuth)',
        email: 'jay.gajjar@github.com',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
        role: 'ADMIN',
        title: 'Principal AI Researcher & Engineer',
        organization: 'Cyclone Detection Labs',
        authProvider: 'github'
      };
    }

    return {
      token: `jwt-oauth-${provider}-${Date.now()}`,
      user: mockProfile
    };
  }
}

export async function loginWithCredentials(
  emailOrId: string,
  password?: string,
  role: 'METEOROLOGIST' | 'ADMIN' | 'ANALYST' | 'OBSERVER' = 'METEOROLOGIST'
): Promise<AuthResponse> {
  try {
    const res = await axios.post(`${API_BASE_URL}/login`, { emailOrId, password, role });
    return res.data;
  } catch (err) {
    console.warn('Backend login endpoint unavailable, resolving credentials fallback profile');
    const nameFromEmail = emailOrId.includes('@')
      ? emailOrId.split('@')[0].replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase())
      : emailOrId;

    const mockProfile: UserProfile = {
      id: `usr-cred-${Date.now()}`,
      name: nameFromEmail || 'Dr. Alkesh Sharma',
      email: emailOrId.includes('@') ? emailOrId : `${emailOrId.toLowerCase()}@imd.gov.in`,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
      role: role,
      title: role === 'ADMIN' ? 'Chief Systems Administrator' : role === 'ANALYST' ? 'Emergency Intelligence Analyst' : 'Lead Meteorological Officer',
      organization: 'IMD Earth Command Hub',
      authProvider: 'credentials'
    };

    return {
      token: `jwt-cred-${Date.now()}`,
      user: mockProfile
    };
  }
}

export async function getCurrentUserSession(): Promise<UserProfile | null> {
  try {
    const res = await axios.get(`${API_BASE_URL}/me`);
    return res.data;
  } catch (err) {
    const saved = localStorage.getItem('cyclovision_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_OPERATOR;
      }
    }
    return DEFAULT_OPERATOR;
  }
}
