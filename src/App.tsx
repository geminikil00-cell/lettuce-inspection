import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { HomePage } from './pages/HomePage';
import { ParametersPage } from './pages/ParametersPage';
import { InspectionPage } from './pages/InspectionPage';
import { ChartsPage } from './pages/ChartsPage';
import { SupabaseProvider } from './hooks/useSupabase';

export default function App() {
  return (
    <BrowserRouter>
      <SupabaseProvider>
        {/* pb-16 to account for mobile bottom nav, min-h-screen to ensure full height */}
        <div className="min-h-screen bg-gray-50/50 pb-20 sm:pb-0">
          <Navigation />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/charts" element={<ChartsPage />} />
              <Route path="/parameters" element={<ParametersPage />} />
              <Route path="/inspect/:id" element={<InspectionPage />} />
            </Routes>
          </main>
        </div>
      </SupabaseProvider>
    </BrowserRouter>
  );
}
