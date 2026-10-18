import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/services': 'Service Discovery',
  '/rate-limiter': 'Rate Limiting',
  '/circuit-breakers': 'Circuit Breakers',
  '/chaos': 'Chaos Control',
  '/simulator': 'Traffic Simulator',
};

export const Header: React.FC = () => {
  const location = useLocation();
  const [showChangelog, setShowChangelog] = useState(false);
  const [upCount, setUpCount] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(10);

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

  const isDegraded = upCount < totalCount;
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Console';

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        <span className="muted">Gateway</span>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span style={{ color: 'var(--text-head)', fontWeight: 500 }}>{pageTitle}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className={`ratio-chip ${isDegraded ? 'degraded' : 'healthy'}`}>
          {isDegraded ? 'Cluster degraded' : 'Cluster healthy'}
          <span className="mono-metric" style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
            {upCount}/{totalCount}
          </span>
        </span>

        <button
          onClick={() => setShowChangelog(true)}
          className="btn-neutral btn-sm"
          title="View release notes"
        >
          v1.5.0
        </button>
      </div>

      <AnimatePresence>
        {showChangelog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowChangelog(false)}
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-tech)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-head)', letterSpacing: '-0.2px' }}>
                  Release notes
                </span>
                <button onClick={() => setShowChangelog(false)} className="btn-ghost btn-sm">
                  Close
                </button>
              </div>

              <div style={{ padding: '4px 20px', fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)', maxHeight: '360px', overflowY: 'auto' }}>
                <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border-tech)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="status-badge mono-metric" style={{ fontSize: '11px' }}>v1.5.0</span>
                    <span style={{ color: 'var(--text-head)', fontWeight: 500 }}>Console redesign</span>
                  </div>
                  <ul style={{ marginTop: '8px', paddingLeft: '18px' }}>
                    <li>New dark interface with a single accent colour and hairline surfaces.</li>
                    <li>Unified status badges, segmented controls and toggle switches.</li>
                    <li>Breadcrumb header and simplified sidebar navigation.</li>
                  </ul>
                </div>

                <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border-tech)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="status-badge mono-metric" style={{ fontSize: '11px' }}>v1.4.2</span>
                    <span style={{ color: 'var(--text-head)', fontWeight: 500 }}>Operator tooling</span>
                  </div>
                  <ul style={{ marginTop: '8px', paddingLeft: '18px' }}>
                    <li>Six domain-specific tool pages for the control plane.</li>
                    <li>Arm switch safety interlock for fault injection.</li>
                    <li>Heartbeat timestamps freeze for DOWN microservices.</li>
                  </ul>
                </div>

                <div style={{ padding: '16px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="status-badge mono-metric" style={{ fontSize: '11px' }}>v1.4.0</span>
                    <span style={{ color: 'var(--text-head)', fontWeight: 500 }}>Infrastructure engine</span>
                  </div>
                  <ul style={{ marginTop: '8px', paddingLeft: '18px' }}>
                    <li>Redis Lua token bucket rate limiter.</li>
                    <li>Active HTTP health probes on microservice endpoints.</li>
                    <li>Prometheus scraping on port 9090 and Grafana on port 3001.</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
