import { apiClient } from './client';
import type { Cyclone, CycloneObservation } from '../types';

// Mock data for immediate fallback
const MOCK_ACTIVE_CYCLONES: Cyclone[] = [
  {
    id: 'cyclone-biparjoy-2023',
    name: 'Cyclone Biparjoy',
    basin: 'Arabian Sea',
    seasonYear: 2023,
    status: 'ACTIVE',
    latestObservation: {
      observedAt: new Date().toISOString(),
      lat: 19.4,
      long: 67.8,
      windSpeedKmh: 165,
      pressureHpa: 954,
      movementDirectionDeg: 340,
      movementSpeedKmh: 14,
      intensityCategory: 'Very Severe Cyclonic Storm',
    },
    observations: [
      { observedAt: '2026-09-06T00:00:00Z', lat: 14.2, long: 66.0, windSpeedKmh: 90, pressureHpa: 990, intensityCategory: 'Cyclonic Storm' },
      { observedAt: '2026-09-06T12:00:00Z', lat: 15.6, long: 66.4, windSpeedKmh: 120, pressureHpa: 978, intensityCategory: 'Severe Cyclonic Storm' },
      { observedAt: '2026-09-07T00:00:00Z', lat: 17.0, long: 66.9, windSpeedKmh: 145, pressureHpa: 965, intensityCategory: 'Very Severe Cyclonic Storm' },
      { observedAt: '2026-09-07T12:00:00Z', lat: 18.2, long: 67.3, windSpeedKmh: 160, pressureHpa: 958, intensityCategory: 'Very Severe Cyclonic Storm' },
      { observedAt: '2026-09-08T00:00:00Z', lat: 19.4, long: 67.8, windSpeedKmh: 165, pressureHpa: 954, intensityCategory: 'Very Severe Cyclonic Storm' },
    ]
  },
  {
    id: 'cyclone-amphan-2020',
    name: 'Cyclone Amphan',
    basin: 'Bay of Bengal',
    seasonYear: 2020,
    status: 'ACTIVE',
    latestObservation: {
      observedAt: new Date().toISOString(),
      lat: 18.2,
      long: 86.9,
      windSpeedKmh: 215,
      pressureHpa: 920,
      movementDirectionDeg: 15,
      movementSpeedKmh: 18,
      intensityCategory: 'Super Cyclonic Storm',
    },
    observations: [
      { observedAt: '2026-09-06T00:00:00Z', lat: 13.0, long: 86.2, windSpeedKmh: 110, pressureHpa: 982, intensityCategory: 'Severe Cyclonic Storm' },
      { observedAt: '2026-09-06T12:00:00Z', lat: 14.5, long: 86.3, windSpeedKmh: 160, pressureHpa: 955, intensityCategory: 'Very Severe Cyclonic Storm' },
      { observedAt: '2026-09-07T00:00:00Z', lat: 16.2, long: 86.5, windSpeedKmh: 195, pressureHpa: 930, intensityCategory: 'Extremely Severe Cyclonic Storm' },
      { observedAt: '2026-09-07T12:00:00Z', lat: 18.2, long: 86.9, windSpeedKmh: 215, pressureHpa: 920, intensityCategory: 'Super Cyclonic Storm' },
    ]
  }
];

export const getActiveCyclones = async (): Promise<Cyclone[]> => {
  try {
    const res = await apiClient.get<Cyclone[]>('/cyclones/active');
    return res.data;
  } catch {
    return MOCK_ACTIVE_CYCLONES;
  }
};

export const getCycloneById = async (id: string): Promise<Cyclone> => {
  try {
    const res = await apiClient.get<Cyclone>(`/cyclones/${id}`);
    return res.data;
  } catch {
    return MOCK_ACTIVE_CYCLONES.find(c => c.id === id) || MOCK_ACTIVE_CYCLONES[0];
  }
};

export const getCycloneObservations = async (id: string): Promise<CycloneObservation[]> => {
  try {
    const res = await apiClient.get<CycloneObservation[]>(`/cyclones/${id}/observations`);
    return res.data;
  } catch {
    const cyclone = MOCK_ACTIVE_CYCLONES.find(c => c.id === id) || MOCK_ACTIVE_CYCLONES[0];
    return cyclone.observations || [];
  }
};
