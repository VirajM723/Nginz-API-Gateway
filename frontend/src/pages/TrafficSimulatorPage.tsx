import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RequestLogEntry {
  id: string;
  timestamp: string;
  clientIp: string;
  service: string;
  instanceId?: string;
  endpoint: string;
  statusCode: number;
  statusText: 'ALLOWED' | 'RATE_LIMITED' | 'DEGRADED' | 'FAILED';
  latencyMs: number;
}

export const TrafficSimulatorPage: React.FC = () => {
  const [rps, setRps] = useState(100);
  const [duration, setDuration] = useState(30);
  const [running, setRunning] = useState(false);
  const [simulation, setSimulation] = useState<any>(null);

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/gateway/traffic/results');
      const data = await res.json();
      if (data.simulation) {
        setSimulation(data.simulation);
        setRunning(data.simulation.isRunning);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchResults();
    const interval = setInterval(fetchResults, 800);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    try {
      const res = await fetch('/api/gateway/traffic/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rps, durationSeconds: duration }),
      });
      const data = await res.json();
      setSimulation(data.simulation);
      setRunning(true);
    } catch {
      // ignore
    }
  };

  const handleStop = async () => {
    try {
      const res = await fetch('/api/gateway/traffic/stop', { method: 'POST' });
      const data = await res.json();
      setSimulation(data.simulation);
      setRunning(false);
    } catch {
      // ignore
    }
  };

  const getStatusBadge = (statusText: RequestLogEntry['statusText'], statusCode: number) => {
    switch (statusText) {
      case 'ALLOWED':
        return <span className="telemetry-tag online">{statusCode}</span>;
      case 'RATE_LIMITED':
        return <span className="telemetry-tag warning">429 limited</span>;
      case 'DEGRADED':
        return <span className="telemetry-tag warning">{statusCode} degraded</span>;
      default:
        return <span className="telemetry-tag offline">{statusCode} failed</span>;
    }
  };

  const counters = simulation
    ? [
        { label: 'Total requests', value: simulation.totalRequests, color: 'var(--text-head)' },
        { label: 'Allowed (2xx)', value: simulation.allowedRequests, color: 'var(--text-head)' },
        { label: 'Rate limited (429)', value: simulation.rateLimitedRequests, color: simulation.rateLimitedRequests > 0 ? 'var(--status-warning)' : 'var(--text-head)' },
        { label: 'Degraded fallbacks', value: simulation.degradedRequests, color: simulation.degradedRequests > 0 ? 'var(--status-warning)' : 'var(--text-head)' },
      ]
    : [];

  const latencies = simulation
    ? [
        { label: 'Avg', value: simulation.avgLatencyMs },
        { label: 'P95', value: simulation.p95Ms },
        { label: 'P99', value: simulation.p99Ms },
      ]
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="page-body"
    >
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Resilience · Load testing</div>
          <h1 className="page-title">Traffic simulator</h1>
          <p className="page-subtitle">
            Generate synthetic load to verify rate limiting, round-robin distribution and fallback behaviour.
          </p>
        </div>
        <span className="status-led-text" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          <span className={`led-dot ${running ? '' : 'idle'}`} />
          {running ? 'Running' : 'Idle'}
        </span>
      </div>

      <div className="grid-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)', gap: '16px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="ops-card">
            <div className="ops-card-header">
              <span className="ops-card-title">Load parameters</span>
              <span className="ops-card-meta">5 rotating client IPs</span>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label className="field-label">Requests per second</label>
              <div className="segmented">
                {[10, 50, 100, 500, 1000].map((val) => (
                  <button key={val} type="button" onClick={() => setRps(val)} className={rps === val ? 'selected' : ''}>
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <label className="field-label">Duration (seconds)</label>
              <input
                type="number"
                value={duration}
                onChange={(e: any) => setDuration(Number(e.target.value))}
                className="text-input mono-metric"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {running && (
                <button className="btn-danger" onClick={handleStop}>
                  Stop
                </button>
              )}
              <button className="btn-primary" onClick={handleStart} disabled={running}>
                {running ? 'Running…' : 'Start test'}
              </button>
            </div>
          </div>

          {simulation && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {counters.map((c) => (
                  <div key={c.label} className="ops-card" style={{ padding: '18px' }}>
                    <div className="stat-label">{c.label}</div>
                    <div className="stat-value" style={{ fontSize: '24px', color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              <div className="ops-card" style={{ padding: '18px' }}>
                <div className="stat-label" style={{ marginBottom: '10px' }}>Latency</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {latencies.map((l, i) => (
                    <div key={l.label} style={{ paddingLeft: i ? '16px' : 0, borderLeft: i ? '1px solid var(--border-tech)' : 'none' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{l.label}</div>
                      <div className="mono-metric" style={{ fontSize: '16px', color: 'var(--text-head)', marginTop: '2px' }}>
                        {l.value}<span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}> ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="ops-card" style={{ display: 'flex', flexDirection: 'column', height: '600px', borderRadius: 'var(--radius-xl)', padding: '20px 16px' }}>
          <div className="ops-card-header" style={{ padding: '0 8px' }}>
            <span className="ops-card-title">Request stream</span>
            <span className="ops-card-meta">Per-instance routing</span>
          </div>

          <div className="mono-metric" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <AnimatePresence>
              {simulation?.recentLogs && simulation.recentLogs.length > 0 ? (
                simulation.recentLogs.map((log: RequestLogEntry) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.12 }}
                    className="log-row"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>{log.timestamp}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{log.clientIp}</span>
                      <span style={{ color: 'var(--text-head)' }}>{log.instanceId || log.service}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {getStatusBadge(log.statusText, log.statusCode)}
                      <span style={{ color: 'var(--text-secondary)', width: '48px', textAlign: 'right' }}>{log.latencyMs}ms</span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="terminal-empty-state">
                  <div><span className="terminal-prompt">$</span> nginz-traffic --stream --filter=all</div>
                  <div style={{ color: 'var(--text-tertiary)', marginTop: '4px' }}>Listening for synthetic load on :8080…</div>
                  <div style={{ marginTop: '8px' }}>Start a test to see per-instance routing logs here.</div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
