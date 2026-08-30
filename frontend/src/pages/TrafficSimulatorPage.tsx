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
        return (
          <span className="telemetry-tag online" style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>
            {statusCode} ALLOWED
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className="telemetry-tag offline" style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>
            429 LIMITED
          </span>
        );
      case 'DEGRADED':
        return (
          <span className="telemetry-tag" style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700, borderColor: 'var(--status-warning-border)', color: 'var(--status-warning)' }}>
            {statusCode} DEGRADED
          </span>
        );
      default:
        return (
          <span className="telemetry-tag offline" style={{ fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>
            {statusCode} FAILED
          </span>
        );
    }
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
          Traffic Load & Latency Simulator
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
          Synthetic load generator evaluating Redis Token Bucket rate limiting, Round-Robin load distribution, and live stream telemetry.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '24px' }}>
        {/* Left Column: Controls & Aggregated Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="ops-card">
            <div className="ops-card-header">
              <span className="ops-card-title">Load Generator Parameters</span>
              <span className="mono-metric" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {running ? 'STATUS // ACTIVE' : 'STATUS // IDLE'}
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>
                Target Requests Per Second (RPS)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[10, 50, 100, 500, 1000].map((val) => (
                  <button
                    key={val}
                    onClick={() => setRps(val)}
                    className="mono-metric"
                    style={{
                      backgroundColor: rps === val ? 'var(--accent-amber)' : 'var(--bg-element)',
                      color: rps === val ? '#ffffff' : 'var(--text-dim)',
                      border: '1px solid var(--border-tech)',
                      padding: '7px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 700,
                      flex: 1,
                    }}
                  >
                    {val} RPS
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                Duration (Seconds)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e: any) => setDuration(Number(e.target.value))}
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

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-primary"
                onClick={handleStart}
                disabled={running}
                style={{
                  opacity: running ? 0.6 : 1,
                  flex: 1,
                  textAlign: 'center',
                }}
              >
                {running ? 'Simulation Active...' : 'Start Traffic Test'}
              </button>

              {running && (
                <button
                  className="btn-danger"
                  onClick={handleStop}
                >
                  Stop Test
                </button>
              )}
            </div>
          </div>

          {/* Aggregated Telemetry Readout Cards */}
          {simulation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="ops-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Total Ingress Sent</div>
                  <div className="mono-metric" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-head)', marginTop: '2px' }}>{simulation.totalRequests}</div>
                </div>

                <div className="ops-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Allowed (2xx)</div>
                  <div className="mono-metric" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-online)', marginTop: '2px' }}>{simulation.allowedRequests}</div>
                </div>

                <div className="ops-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Rate Limited (429)</div>
                  <div className="mono-metric" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-offline)', marginTop: '2px' }}>{simulation.rateLimitedRequests}</div>
                </div>

                <div className="ops-card" style={{ padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Degraded Fallbacks</div>
                  <div className="mono-metric" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-warning)', marginTop: '2px' }}>{simulation.degradedRequests}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
                <div className="ops-card" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>AVG LATENCY</div>
                  <div className="mono-metric" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-head)', marginTop: '2px' }}>{simulation.avgLatencyMs} ms</div>
                </div>

                <div className="ops-card" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>P95 LATENCY</div>
                  <div className="mono-metric" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-head)', marginTop: '2px' }}>{simulation.p95Ms} ms</div>
                </div>

                <div className="ops-card" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>P99 LATENCY</div>
                  <div className="mono-metric" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-head)', marginTop: '2px' }}>{simulation.p99Ms} ms</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Request Logs Stream Console with Terminal Shell Prompt Empty State */}
        <div className="ops-card" style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div className="ops-card-header">
            <span className="ops-card-title">Live Ingress Telemetry Stream</span>
            <span className="mono-metric" style={{ fontSize: '11px', color: 'var(--accent-amber)' }}>
              PER-NODE ROUTE LOGS
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <AnimatePresence>
              {simulation?.recentLogs && simulation.recentLogs.length > 0 ? (
                simulation.recentLogs.map((log: RequestLogEntry) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.12 }}
                    className="mono-metric"
                    style={{
                      backgroundColor: 'var(--bg-element)',
                      border: '1px solid var(--border-tech)',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>{log.timestamp}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-head)' }}>{log.clientIp}</span>
                      <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>{log.instanceId || log.service}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {getStatusBadge(log.statusText, log.statusCode)}
                      <span style={{ color: 'var(--text-dim)', fontSize: '10px', width: '40px', textAlign: 'right' }}>{log.latencyMs}ms</span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="terminal-empty-state">
                  <div><span className="terminal-prompt">$</span> nginz-traffic --stream --filter=all</div>
                  <div style={{ color: 'var(--status-online)', marginTop: '4px' }}>[INFO] Listening for synthetic load test stream on port 8080...</div>
                  <div style={{ marginTop: '8px', color: 'var(--text-dim)' }}>→ Launch simulation to view real-time per-instance ingress routing logs.</div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
