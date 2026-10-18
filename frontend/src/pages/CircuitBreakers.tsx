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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="page-body"
    >
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Traffic · Fault isolation</div>
          <h1 className="page-title">Circuit breakers</h1>
          <p className="page-subtitle">
            Per-domain state machines that stop cascading failures and route traffic to degraded fallbacks.
          </p>
        </div>

        <button onClick={handleResetAll} className="btn-neutral" disabled={isResetting}>
          {isResetting ? 'Resetting…' : 'Reset all breakers'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 500, letterSpacing: '-0.2px' }}>
                  {sName}
                </h3>

                <div className={`breaker-block-badge ${isOpen ? 'open' : isHalfOpen ? 'half' : ''}`}>
                  <div className="badge-block" />
                  <div className="badge-label">{breaker.state}</div>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', minHeight: '40px' }}>
                {isOpen
                  ? 'Tripped. Requests to this domain are blocked and routed to degraded fallbacks.'
                  : isHalfOpen
                  ? 'Trial probe. A single test request is evaluating instance health.'
                  : 'Nominal. All requests flow directly to healthy instances.'}
              </div>

              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>Failure threshold</span>
                  <span className="mono-metric" style={{ color: isOpen ? 'var(--status-offline)' : 'var(--text-head)' }}>
                    {breaker.failures}/{maxFailures}
                  </span>
                </div>
                <div className="fault-meter-bar">
                  <div
                    className={`fault-meter-fill ${isOpen ? 'open' : isHalfOpen ? 'half' : ''}`}
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-tertiary)', paddingTop: '14px', borderTop: '1px solid var(--border-tech)' }}>
                <span>Recovery timeout <span className="mono-metric" style={{ color: 'var(--text-secondary)' }}>3000ms</span></span>
                <span>Probes <span className="mono-metric" style={{ color: 'var(--text-secondary)' }}>{breaker.successes || 0} ok</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
