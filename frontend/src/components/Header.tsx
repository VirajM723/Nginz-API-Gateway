import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const Header: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  const [showChangelog, setShowChangelog] = useState(false);
  const [upCount, setUpCount] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(10);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/api/gateway/services');
        const data = await res.json();
        if (data.services) {
          let healthy = 0;
          let total = 0;
          Object.values(data.services).forEach((list: any) => {
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
      } catch {
        // fallback
      }
    };

    fetchTelemetry();
    const timer = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const isDegraded = upCount < totalCount;

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-head)' }}>
          NginZ API Gateway Console
        </h2>

        {/* Clickable Version Badge */}
        <button
          onClick={() => setShowChangelog(true)}
          className="ratio-chip"
          style={{ fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }}
          title="Click to view release notes"
        >
          v1.4.2
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Dynamic Authoritative Consolidated Status Treatment */}
        <div className="status-led-text">
          <span className={`led-dot ${isDegraded ? 'offline' : ''}`} />
          <span style={{ color: isDegraded ? 'var(--status-offline)' : 'var(--status-online)', fontWeight: 700 }}>
            {isDegraded ? 'CLUSTER DEGRADED' : 'CLUSTER HEALTHY'}
          </span>
          <span className={`ratio-chip ${isDegraded ? '' : 'healthy'}`} style={{ marginLeft: '6px', fontWeight: 700 }}>
            {upCount}/{totalCount} UP
          </span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="btn-neutral"
          style={{ padding: '4px 10px', fontSize: '12px' }}
        >
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>

      {/* Changelog Modal Overlay */}
      <AnimatePresence>
        {showChangelog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              padding: '20px',
            }}
            onClick={() => setShowChangelog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              style={{
                width: '100%',
                maxWidth: '540px',
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-tech)',
                borderRadius: '8px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-tech)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="mono-metric" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-head)' }}>
                  RELEASE NOTES — v1.4.2
                </span>
                <button onClick={() => setShowChangelog(false)} className="btn-neutral" style={{ padding: '2px 8px', fontSize: '12px' }}>
                  Close
                </button>
              </div>

              <div style={{ padding: '20px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-dim)', maxHeight: '360px', overflowY: 'auto' }}>
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ color: 'var(--text-head)', fontWeight: 700 }}>v1.4.2 — Visual Aesthetics & NOC Layout Overhaul</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    • Replaced generic cards with 6 distinct domain-driven tool interfaces.<br />
                    • Added 3 visual status treatments: LED indicator, ratio chips, and block state badges.<br />
                    • Integrated ARM FAULT INJECTION safety switch with visual hazard alert modes.<br />
                    • Fixed Heartbeat ping timestamp freeze behavior for DOWN microservices.
                  </div>
                </div>

                <div>
                  <div style={{ color: 'var(--text-head)', fontWeight: 700 }}>v1.4.0 — Infrastructure Engine Upgrades</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    • Added Redis Lua script sliding token bucket rate limiter.<br />
                    • Active HTTP health probes on microservice endpoints.<br />
                    • Prometheus metrics scraping on port 9090 & Grafana dashboard on port 3001.
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-element)', borderTop: '1px solid var(--border-tech)', textAlign: 'right' }}>
                <button onClick={() => setShowChangelog(false)} className="btn-neutral" style={{ fontSize: '12px' }}>
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
