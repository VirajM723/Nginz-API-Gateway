import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const RateLimiterPage: React.FC = () => {
  const [maxTokens, setMaxTokens] = useState<number>(100);
  const [refillRate, setRefillRate] = useState<number>(100);
  const [windowMs, setWindowMs] = useState<number>(60000);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/gateway/rate-limiter');
      const data = await res.json();
      if (data.config) {
        setMaxTokens(data.config.maxTokens);
        setRefillRate(data.config.refillRate);
        setWindowMs(data.config.windowMs);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/gateway/rate-limiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxTokens, refillRate, windowMs }),
      });
      const data = await res.json();
      setStatusMessage(data.message || 'Rate limit configuration updated in Redis.');
    } catch (err: any) {
      setStatusMessage(`Error updating configuration: ${err.message}`);
    }
  };

  const applyPreset = (max: number, refill: number, win: number) => {
    setMaxTokens(max);
    setRefillRate(refill);
    setWindowMs(win);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="page-body"
    >
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-head)', letterSpacing: '-0.02em' }}>
          Rate Limiter Configuration
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
          Dynamic Redis Token Bucket parameters controlling maximum per-IP token capacity and refill windows.
        </p>
      </div>

      {/* Asymmetric 2-Column Split: Left = Settings Form; Right = Presets & Live Simulation Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Left Column: Bucket Settings Form */}
        <div className="ops-card">
          <div className="ops-card-header">
            <span className="ops-card-title">Token Bucket Policy Settings</span>
            <span className="mono-metric" style={{ fontSize: '11px', color: 'var(--status-online)' }}>
              REDIS LUA ENGINE
            </span>
          </div>

          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                Maximum Token Capacity (Per Client IP)
              </label>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="mono-metric"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg-element)',
                  border: '1px solid var(--border-tech)',
                  borderRadius: '4px',
                  color: 'var(--text-head)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                Refill Tokens Per Window
              </label>
              <input
                type="number"
                value={refillRate}
                onChange={(e) => setRefillRate(Number(e.target.value))}
                className="mono-metric"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg-element)',
                  border: '1px solid var(--border-tech)',
                  borderRadius: '4px',
                  color: 'var(--text-head)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                Refill Window Duration (ms)
              </label>
              <input
                type="number"
                value={windowMs}
                onChange={(e) => setWindowMs(Number(e.target.value))}
                className="mono-metric"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: 'var(--bg-element)',
                  border: '1px solid var(--border-tech)',
                  borderRadius: '4px',
                  color: 'var(--text-head)',
                  fontSize: '13px',
                }}
              />
            </div>

            {statusMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: '12px',
                  padding: '10px 12px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--status-online-bg)',
                  border: '1px solid var(--status-online-border)',
                  color: 'var(--status-online)',
                  fontWeight: 600,
                }}
              >
                {statusMessage}
              </motion.div>
            )}

            <button
              type="submit"
              className="btn-primary"
              style={{ marginTop: '4px', textAlign: 'center' }}
            >
              Update Rate Limits
            </button>
          </form>
        </div>

        {/* Right Column: Quick Policy Presets & Simulation Preview (Fills Dead Space) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="ops-card">
            <div className="ops-card-header">
              <span className="ops-card-title">Quick Policy Presets</span>
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>PRESETS</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                onClick={() => applyPreset(1000, 1000, 60000)}
                style={{
                  backgroundColor: 'var(--bg-element)',
                  border: '1px solid var(--border-tech)',
                  borderRadius: '6px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-head)', fontSize: '13px' }}>High-Throughput Public API</div>
                <div className="mono-metric" style={{ fontSize: '11px', color: 'var(--accent-amber)', marginTop: '2px' }}>
                  1000 Tokens / 60s window
                </div>
              </div>

              <div
                onClick={() => applyPreset(10, 10, 60000)}
                style={{
                  backgroundColor: 'var(--bg-element)',
                  border: '1px solid var(--border-tech)',
                  borderRadius: '6px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-head)', fontSize: '13px' }}>Strict Auth & Password Endpoint</div>
                <div className="mono-metric" style={{ fontSize: '11px', color: 'var(--status-offline)', marginTop: '2px' }}>
                  10 Tokens / 60s window
                </div>
              </div>

              <div
                onClick={() => applyPreset(100, 100, 60000)}
                style={{
                  backgroundColor: 'var(--bg-element)',
                  border: '1px solid var(--border-tech)',
                  borderRadius: '6px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-head)', fontSize: '13px' }}>Standard Tier Default</div>
                <div className="mono-metric" style={{ fontSize: '11px', color: 'var(--status-online)', marginTop: '2px' }}>
                  100 Tokens / 60s window
                </div>
              </div>
            </div>
          </div>

          <div className="ops-card">
            <div className="ops-card-header">
              <span className="ops-card-title">Token Capacity Simulation Preview</span>
              <span className="mono-metric" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                PREVIEW
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Capacity Fill Ratio</span>
                <span className="mono-metric" style={{ color: 'var(--status-online)', fontWeight: 700 }}>80 / {maxTokens} TOKENS</span>
              </div>
              <div className="fault-meter-bar">
                <div className="fault-meter-fill" style={{ width: '80%' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                At {refillRate} refill rate every {windowMs}ms, clients can burst up to {maxTokens} concurrent requests before receiving HTTP 429.
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
