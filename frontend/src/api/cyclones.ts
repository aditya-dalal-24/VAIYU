import { apiClient } from './client';
import type { Cyclone, CycloneObservation } from '../types';

export const getActiveCyclones = async (): Promise<Cyclone[]> => {
  const res = await apiClient.get<Cyclone[]>('/cyclones/active');
  return res.data;
};

export const getCycloneById = async (id: string): Promise<Cyclone> => {
  const res = await apiClient.get<Cyclone>(`/cyclones/${id}`);
  return res.data;
};

export const getCycloneObservations = async (id: string): Promise<CycloneObservation[]> => {
  const res = await apiClient.get<CycloneObservation[]>(`/cyclones/${id}/observations`);
  return res.data;
};
