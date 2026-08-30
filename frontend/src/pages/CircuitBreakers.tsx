import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const CircuitBreakersPage: React.FC = () => {
  const [breakers, setBreakers] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchBreakers = async () => {
      try {
        const res = await fetch('/api/gateway/circuit-breakers');
        const data = await res.json();
        setBreakers(data.breakers || {});
      } catch {
        // fallback
      }
    };
    fetchBreakers();
    const timer = setInterval(fetchBreakers, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="page-body"
    >
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-head)', letterSpacing: '-0.02em' }}>
          Circuit Breaker Protection Controls
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
          Automated fault isolation state machines preventing cascading failures across microservices.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {['auth-service', 'user-service', 'product-service', 'order-service', 'payment-service'].map((sName) => {
          const breaker = breakers[sName] || { state: 'CLOSED', failures: 0, successes: 0 };
          const isOpen = breaker.state === 'OPEN';
          const isHalfOpen = breaker.state === 'HALF_OPEN';
          const maxFailures = 5;
          const fillPercent = Math.min(100, Math.max(0, (breaker.failures / maxFailures) * 100));

          return (
            <div
              key={sName}
              className={`breaker-module ${isOpen ? 'is-open' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid var(--border-tech)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-head)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  {sName}
                </h3>

                {/* Treatment 3: Industrial Block Badge */}
                <div className={`breaker-block-badge ${isOpen ? 'open' : isHalfOpen ? 'half' : ''}`}>
                  <div className="badge-block" />
                  <div className="badge-label">{breaker.state}</div>
                </div>
              </div>

              {/* Clean CSS Progress Fill Bar (Replaces Broken ASCII Hatch Gauge) */}
              <div style={{ backgroundColor: 'var(--bg-chassis)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-tech)', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
                  <span>Consecutive Fault Load</span>
                  <span className="mono-metric">{breaker.failures} / {maxFailures} FAULTS</span>
                </div>
                <div className="fault-meter-bar">
                  <div
                    className={`fault-meter-fill ${fillPercent >= 100 ? 'danger' : fillPercent >= 60 ? 'warning' : ''}`}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div style={{ backgroundColor: 'var(--bg-chassis)', padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--border-tech)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Healthy Probes</div>
                  <div className="mono-metric" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-online)' }}>{breaker.successes}</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-chassis)', padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--border-tech)' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Reset Window</div>
                  <div className="mono-metric" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-amber)' }}>3.0s</div>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {isOpen
                  ? 'Circuit OPEN: Ingress requests blocked. Redirecting to cache or async fallback queue.'
                  : isHalfOpen
                  ? 'Circuit HALF_OPEN: Probe requests active. Testing downstream recovery.'
                  : 'Circuit CLOSED: Normal operation. Forwarding requests to service nodes.'}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
