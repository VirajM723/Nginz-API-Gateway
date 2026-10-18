import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose }) => {
  const location = useLocation();
  const [upCount, setUpCount] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(10);
  const [openBreakers, setOpenBreakers] = useState<number>(0);
  const [totalBreakers, setTotalBreakers] = useState<number>(5);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
          let total = 0;
          Object.values(sData.services).forEach((list: any) => {
            if (Array.isArray(list)) {
              total += list.length;
              healthy += list.filter((inst) => inst.status === 'UP').length;
            }
          });
          if (total > 0) {
            setTotalCount(total);
            setUpCount(healthy);
          }
        }

        if (bData.breakers) {
          const all = Object.values(bData.breakers) as any[];
          setOpenBreakers(all.filter((b) => b.state === 'OPEN').length);
          if (all.length > 0) setTotalBreakers(all.length);
        }
      } catch {
        // fallback
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  const isDegraded = upCount < totalCount;

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
      <div className="logo-container">
        <span className="logo-mark">N</span>
        <span className="logo-title">NginZ</span>
        <span className="logo-subtitle">Gateway</span>
        <button type="button" className="btn-ghost btn-sm sidebar-close" onClick={onClose} aria-label="Close navigation">
          Close
        </button>
      </div>

      <nav className="nav-menu">
        <div className="nav-section-title">Core</div>
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Overview</span>
        </NavLink>

        <NavLink to="/services" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Service Discovery</span>
          <span className={`nav-badge ${isDegraded ? 'active-warn' : ''}`}>{upCount}/{totalCount}</span>
        </NavLink>

        <div className="nav-section-title">Traffic</div>
        <NavLink to="/rate-limiter" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Rate Limiting</span>
        </NavLink>

        <NavLink to="/circuit-breakers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Circuit Breakers</span>
          <span className={`nav-badge ${openBreakers > 0 ? 'active-warn' : ''}`}>
            {openBreakers > 0 ? `${openBreakers} open` : `${totalBreakers}/${totalBreakers}`}
          </span>
        </NavLink>

        <div className="nav-section-title">Resilience</div>
        <NavLink to="/chaos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Chaos Control</span>
        </NavLink>

        <NavLink to="/simulator" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span>Traffic Simulator</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <span className="status-led-text" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span className={`led-dot ${isDegraded ? 'offline' : ''}`} />
          {isDegraded ? 'Degraded' : 'All systems normal'}
        </span>
      </div>
    </aside>
  );
};
