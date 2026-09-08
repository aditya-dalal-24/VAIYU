import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Cyclone, Prediction, RiskAssessment, Alert } from './types';
import { getActiveCyclones, getCycloneObservations } from './api/cyclones';
import { getPredictions } from './api/predictions';
import { getRiskAssessment } from './api/risk';
import { getActiveAlerts } from './api/alerts';
import { Navbar } from './components/layout/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { CycloneDetailsPage } from './pages/CycloneDetailsPage';
import { SatelliteAnalysisPage } from './pages/SatelliteAnalysisPage';
import { PredictionsPage } from './pages/PredictionsPage';
import { HistoricalSimilarityPage } from './pages/HistoricalSimilarityPage';
import { AlertsPage } from './pages/AlertsPage';
import { Globe3DVisualizer } from './components/map/Globe3DVisualizer';

import { AuthProvider } from './context/AuthContext';

const queryClient = new QueryClient();

export function CycloVisionApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cyclones, setCyclones] = useState<Cyclone[]>([]);
  const [selectedCyclone, setSelectedCyclone] = useState<Cyclone | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const activeList = await getActiveCyclones();
        setCyclones(activeList);
        if (activeList.length > 0) {
          const first = activeList[0];
          setSelectedCyclone(first);

          const [obsList, predRes, riskRes, alertList] = await Promise.all([
            getCycloneObservations(first.id),
            getPredictions(first.id),
            getRiskAssessment(first.id),
            getActiveAlerts()
          ]);

          setSelectedCyclone({ ...first, observations: obsList });
          setPrediction(predRes);
          setRisk(riskRes);
          setAlerts(alertList);
        }
      } catch (err) {
        console.error('Failed loading initial data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // When selected cyclone changes
  const handleSelectCyclone = async (cyclone: Cyclone) => {
    setSelectedCyclone(cyclone);
    const [obsList, predRes, riskRes] = await Promise.all([
      getCycloneObservations(cyclone.id),
      getPredictions(cyclone.id),
      getRiskAssessment(cyclone.id)
    ]);
    setSelectedCyclone({ ...cyclone, observations: obsList });
    setPrediction(predRes);
    setRisk(riskRes);
  };

  if (loading || !selectedCyclone) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold tracking-wider text-indigo-300">Initializing CycloVision AI Intelligence Platform...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#03050B] text-gray-100 flex flex-col selection:bg-indigo-500 selection:text-white font-sans">
      {/* Top Navbar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        cyclones={cyclones}
        onSelectCyclone={handleSelectCyclone}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {activeTab === 'dashboard' && (
          <DashboardPage
            cyclones={cyclones}
            selectedCyclone={selectedCyclone}
            setSelectedCyclone={handleSelectCyclone}
            prediction={prediction}
            risk={risk}
            alerts={alerts}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center glass-panel p-4 rounded-xl border border-gray-800">
              <div>
                <h2 className="font-bold text-white text-lg">Interactive 3D Earth Wind Vector Globe</h2>
                <p className="text-xs text-gray-400">Click and drag to rotate the globe in 3D | Scroll wheel to zoom</p>
              </div>
              <span className="text-xs text-emerald-400 font-mono px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                3D Spherical Vector Field Active
              </span>
            </div>
            <Globe3DVisualizer cyclone={selectedCyclone} prediction={prediction || undefined} height="780px" />
          </div>
        )}

        {activeTab === 'details' && (
          <CycloneDetailsPage
            cyclone={selectedCyclone}
            observations={selectedCyclone.observations || []}
          />
        )}

        {activeTab === 'satellite' && (
          <SatelliteAnalysisPage cyclone={selectedCyclone} />
        )}

        {activeTab === 'predictions' && (
          <PredictionsPage cyclone={selectedCyclone} prediction={prediction} />
        )}

        {activeTab === 'historical' && (
          <HistoricalSimilarityPage cyclone={selectedCyclone} />
        )}

        {activeTab === 'alerts' && (
          <AlertsPage cyclone={selectedCyclone} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/80 py-4 text-center text-xs text-gray-500 glass-panel mt-8">
        <p>CycloVision — Multi-Modal AI Tropical Cyclone Intelligence & Early Warning System</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CycloVisionApp />
      </AuthProvider>
    </QueryClientProvider>
  );
}
