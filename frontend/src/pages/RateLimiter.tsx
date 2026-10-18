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

  const presets = [
    { name: 'Standard', desc: 'Balanced default for most routes', max: 100, refill: 100, win: 60000 },
    { name: 'High throughput', desc: 'Public API with large bursts', max: 1000, refill: 1000, win: 60000 },
    { name: 'Strict auth', desc: 'Login and password endpoints', max: 10, refill: 10, win: 60000 },
  ];

  const fields = [
    { label: 'Maximum tokens per client IP', value: maxTokens, set: setMaxTokens },
    { label: 'Refill tokens per window', value: refillRate, set: setRefillRate },
    { label: 'Window duration (ms)', value: windowMs, set: setWindowMs },
  ];

  const previewFill = Math.min(80, maxTokens);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="page-body"
    >
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Traffic · Token bucket</div>
          <h1 className="page-title">Rate limiting</h1>
          <p className="page-subtitle">
            Redis token bucket policy controlling per-IP burst capacity and refill windows. Changes apply without a restart.
          </p>
        </div>
      </div>

      <div className="grid-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>
        <div className="ops-card">
          <div className="ops-card-header">
            <span className="ops-card-title">Policy</span>
            <span className="ops-card-meta">Redis Lua engine</span>
          </div>

          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {fields.map((f) => (
              <div key={f.label}>
                <label className="field-label">{f.label}</label>
                <input
                  type="number"
                  value={f.value}
                  onChange={(e) => f.set(Number(e.target.value))}
                  className="text-input mono-metric"
                />
              </div>
            ))}

            {statusMessage && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="callout">
                <span className="status-led-text" style={{ fontSize: '13px' }}>
                  <span className="led-dot" />
                  {statusMessage}
                </span>
              </motion.div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button type="submit" className="btn-primary">
                Save policy
              </button>
            </div>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="ops-card">
            <div className="ops-card-header">
              <span className="ops-card-title">Presets</span>
              <span className="ops-card-meta">Click to apply</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {presets.map((p) => {
                const selected = maxTokens === p.max && refillRate === p.refill && windowMs === p.win;
                return (
                  <div
                    key={p.name}
                    onClick={() => applyPreset(p.max, p.refill, p.win)}
                    className="tile interactive"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderColor: selected ? 'var(--accent)' : undefined,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-head)' }}>{p.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{p.desc}</div>
                    </div>
                    <span className="mono-metric" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {p.max} / {p.win / 1000}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="ops-card">
            <div className="ops-card-header">
              <span className="ops-card-title">Bucket preview</span>
              <span className="mono-metric" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {previewFill} / {maxTokens}
              </span>
            </div>

            <div className="fault-meter-bar" style={{ height: '6px', marginTop: 0 }}>
              <div className="fault-meter-fill" style={{ width: `${maxTokens > 0 ? (previewFill / maxTokens) * 100 : 0}%` }} />
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '14px' }}>
              Clients can burst up to <span className="mono-metric" style={{ color: 'var(--text-head)' }}>{maxTokens}</span> requests,
              refilling <span className="mono-metric" style={{ color: 'var(--text-head)' }}>{refillRate}</span> tokens every{' '}
              <span className="mono-metric" style={{ color: 'var(--text-head)' }}>{windowMs}ms</span>, before receiving HTTP 429.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
