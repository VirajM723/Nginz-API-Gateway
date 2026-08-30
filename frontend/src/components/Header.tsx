import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const Header: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

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
        {/* ONE Authoritative Consolidated Status Treatment */}
        <div className="status-led-text">
          <span className="led-dot" />
          <span>CLUSTER HEALTHY</span>
          <span className="ratio-chip healthy" style={{ marginLeft: '4px' }}>10/10 UP</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="btn-neutral"
          style={{ padding: '4px 10px', fontSize: '12px' }}
        >
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </div>

      {/* Changelog Modal */}
      <AnimatePresence>
        {showChangelog && (
          <div className="modal-overlay" onClick={() => setShowChangelog(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-head)' }}>
                  NginZ Gateway Release Notes (v1.4.2)
                </h3>
                <button onClick={() => setShowChangelog(false)} style={{ color: 'var(--text-dim)', fontSize: '18px' }}>✕</button>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <strong style={{ color: 'var(--text-head)' }}>• Dynamic Breaker Auto-Reset</strong>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Circuit breakers now auto-reset to CLOSED the instant a healthy probe ping succeeds.</p>
                </div>

                <div>
                  <strong style={{ color: 'var(--text-head)' }}>• Selective Degradation Policies</strong>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Product service degrades to Redis cache (`200 OK`), Payment service degrades to RabbitMQ async queue (`202 Accepted`).</p>
                </div>

                <div>
                  <strong style={{ color: 'var(--text-head)' }}>• Redis Lua Token Bucket Rate Limiting</strong>
                  <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Atomic rate limiting per client IP with dynamic capacity adjustments.</p>
                </div>
              </div>

              <div style={{ marginTop: '20px', textAlign: 'right' }}>
                <button className="btn-neutral" onClick={() => setShowChangelog(false)}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
};
