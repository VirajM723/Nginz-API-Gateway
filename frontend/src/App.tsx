import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Overview } from './pages/Overview';
import { ServicesPage } from './pages/Services';
import { RateLimiterPage } from './pages/RateLimiter';
import { CircuitBreakersPage } from './pages/CircuitBreakers';
import { ChaosPage } from './pages/ChaosPage';
import { TrafficSimulatorPage } from './pages/TrafficSimulatorPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Header />
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/rate-limiter" element={<RateLimiterPage />} />
            <Route path="/circuit-breakers" element={<CircuitBreakersPage />} />
            <Route path="/chaos" element={<ChaosPage />} />
            <Route path="/simulator" element={<TrafficSimulatorPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
};
