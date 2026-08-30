import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

export const Sidebar: React.FC = () => {
  const [upCount, setUpCount] = useState<number>(10);
  const [openBreakers, setOpenBreakers] = useState<number>(0);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const [servicesRes, breakerRes] = await Promise.all([
          fetch('/api/gateway/services'),
          fetch('/api/gateway/circuit-breakers'),
        ]);
        const sData = await servicesRes.json();
        const bData = await breakerRes.json();

        if (sData.services) {
          let healthy = 0;
          Object.values(sData.services).forEach((list: any) => {
            if (Array.isArray(list)) {
              healthy += list.filter((inst) => inst.status === 'UP').length;
            }
          });
          setUpCount(healthy);
        }

        if (bData.breakers) {
          let open = 0;
          Object.values(bData.breakers).forEach((b: any) => {
            if (b.state === 'OPEN') open++;
          });
          setOpenBreakers(open);
        }
      } catch {
        // fallback
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <span className="logo-badge">NGINZ</span>
        <span className="logo-title">Control Plane</span>
      </div>

      <nav className="nav-menu">
        <div className="nav-section-title">CORE SYSTEM</div>
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Overview</span>
          <span className="nav-badge">NOC</span>
        </NavLink>

        <NavLink to="/services" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Service Discovery</span>
          <span className={`nav-badge ${upCount < 10 ? 'active-warn' : 'active-up'}`}>{upCount}/10 UP</span>
        </NavLink>

        <div className="nav-section-title">TRAFFIC CONTROL</div>
        <NavLink to="/rate-limiter" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Rate Limiting</span>
          <span className="nav-badge">TOKEN BUCKET</span>
        </NavLink>

        <NavLink to="/circuit-breakers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Circuit Breakers</span>
          <span className={`nav-badge ${openBreakers > 0 ? 'active-warn' : 'active-up'}`}>
            {openBreakers > 0 ? `${openBreakers} OPEN` : '5/5 OK'}
          </span>
        </NavLink>

        <div className="nav-section-title">RESILIENCE & TESTING</div>
        <NavLink to="/chaos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Chaos Control</span>
          <span className="nav-badge">FAULT</span>
        </NavLink>

        <NavLink to="/simulator" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Traffic Simulator</span>
          <span className="nav-badge">LOAD</span>
        </NavLink>
      </nav>
    </aside>
  );
};
