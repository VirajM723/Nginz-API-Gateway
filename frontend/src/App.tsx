import React, { useState } from 'react';
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
  const [navOpen, setNavOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
        <div className="main-content">
          <Header onOpenNav={() => setNavOpen(true)} />
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
