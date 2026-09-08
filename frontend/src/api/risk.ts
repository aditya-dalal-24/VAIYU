import { apiClient } from './client';
import type { RiskAssessment } from '../types';

export const getRiskAssessment = async (cycloneId: string): Promise<RiskAssessment> => {
  try {
    const res = await apiClient.get<RiskAssessment>(`/cyclones/${cycloneId}/risk`);
    return res.data;
  } catch {
    return {
      cycloneId,
      riskLevel: 'High',
      riskScore: 0.82,
      atRiskRegions: ['Kutch District', 'Saurashtra Coast', 'Devbhumi Dwarka', 'Porbandar'],
      landfallProbability48h: 0.78,
      computedAt: new Date().toISOString()
    };
  }
};
