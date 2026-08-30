import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const CircuitBreakersPage: React.FC = () => {
  const [breakers, setBreakers] = useState<Record<string, any>>({});
  const [isResetting, setIsResetting] = useState(false);

  const fetchBreakers = async () => {
    try {
      const res = await fetch('/api/gateway/circuit-breakers');
      const data = await res.json();
      setBreakers(data.breakers || {});
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchBreakers();
    const timer = setInterval(fetchBreakers, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/gateway/circuit-breakers/reset', { method: 'POST' });
      const data = await res.json();
      setBreakers(data.breakers || {});
    } catch {
      // fallback reset locally
      setBreakers({
        'auth-service': { state: 'CLOSED', failures: 0, successes: 0 },
        'user-service': { state: 'CLOSED', failures: 0, successes: 0 },
        'product-service': { state: 'CLOSED', failures: 0, successes: 0 },
        'order-service': { state: 'CLOSED', failures: 0, successes: 0 },
        'payment-service': { state: 'CLOSED', failures: 0, successes: 0 },
      });
    } finally {
      setTimeout(() => setIsResetting(false), 500);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="page-body"
    >
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-head)', letterSpacing: '-0.02em' }}>
            Circuit Breaker Protection Controls
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
            Automated fault isolation state machines preventing cascading failures across microservices.
          </p>
        </div>

        <button
          onClick={handleResetAll}
          className="btn-neutral"
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 700,
            borderColor: 'var(--status-online)',
            color: 'var(--status-online)',
          }}
        >
          {isResetting ? 'Resetting All Breakers...' : 'Reset All Breakers'}
        </button>
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

              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '16px' }}>
                {isOpen
                  ? 'Tripped: Requests to this service domain are actively blocked and routed to degraded fallbacks.'
                  : isHalfOpen
                  ? 'Trial probe: Routing single test request to evaluate microservice health.'
                  : 'Nominal operation: All requests flowing directly to healthy instances.'}
              </div>

              {/* Fault Meter Gauge Bar */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }} className="mono-metric">
                  <span>FAULT LOAD THRESHOLD</span>
                  <span style={{ color: isOpen ? 'var(--status-offline)' : 'var(--text-head)', fontWeight: 700 }}>
                    {breaker.failures} / {maxFailures} FAILURES
                  </span>
                </div>
                <div className="fault-meter-bar">
                  <div
                    className={`fault-meter-fill ${isOpen ? 'open' : isHalfOpen ? 'half' : ''}`}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-dim)' }} className="mono-metric">
                <span>RECOVERY TIMEOUT: 3000ms</span>
                <span>STATE PROBES: {breaker.successes || 0} OK</span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
