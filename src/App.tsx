import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { ParametersPage } from './pages/ParametersPage';
import { InspectionPage } from './pages/InspectionPage';
import { SupabaseProvider } from './hooks/useSupabase';

export default function App() {
  return (
    <BrowserRouter>
      <SupabaseProvider>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/parameters" element={<ParametersPage />} />
            <Route path="/inspect/:id" element={<InspectionPage />} />
          </Routes>
        </div>
      </SupabaseProvider>
    </BrowserRouter>
  );
}
