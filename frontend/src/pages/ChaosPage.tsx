import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface DiscoveredInstance {
  instanceId: string;
  serviceName: string;
  host: string;
  port: number;
  status: string;
  lastPing: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  target: string;
  action: string;
  status: string;
}

export const ChaosPage: React.FC = () => {
  const [instances, setInstances] = useState<DiscoveredInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isArmed, setIsArmed] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('nginz_chaos_audit_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/gateway/services');
      const data = await res.json();
      const allInstances: DiscoveredInstance[] = [];

      if (data.services) {
        Object.entries(data.services).forEach(([sName, list]: [string, any]) => {
          if (Array.isArray(list)) {
            list.forEach((inst: any) => {
              allInstances.push({
                instanceId: inst.instanceId || `${sName}-1`,
                serviceName: sName,
                host: inst.host || 'localhost',
                port: inst.port,
                status: inst.status || 'UP',
                lastPing: inst.lastPing,
              });
            });
          }
        });
      }

      if (allInstances.length === 0) {
        allInstances.push(
          { instanceId: 'auth-service-1', serviceName: 'auth-service', host: 'auth-service-1', port: 3001, status: 'UP', lastPing: new Date().toISOString() },
          { instanceId: 'user-service-1', serviceName: 'user-service', host: 'user-service-1', port: 3002, status: 'UP', lastPing: new Date().toISOString() },
          { instanceId: 'product-service-1', serviceName: 'product-service', host: 'product-service-1', port: 3003, status: 'UP', lastPing: new Date().toISOString() },
          { instanceId: 'order-service-1', serviceName: 'order-service', host: 'order-service-1', port: 3004, status: 'UP', lastPing: new Date().toISOString() },
          { instanceId: 'payment-service-1', serviceName: 'payment-service', host: 'payment-service-1', port: 3005, status: 'UP', lastPing: new Date().toISOString() }
        );
      }

      setInstances(allInstances);
      setSelectedInstanceId((prev) => {
        if (prev && allInstances.some((inst) => inst.instanceId === prev)) return prev;
        return allInstances.length > 0 ? allInstances[0].instanceId : '';
      });
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerChaos = async (faultType: string, body?: any) => {
    if (!isArmed && faultType !== '/restore') {
      setStatusMessage('Safety Latch Engaged: Toggle "ARM FAULT INJECTION" switch before executing fault actions.');
      return;
    }

    const targetInst = instances.find((i) => i.instanceId === selectedInstanceId);
    if (!targetInst) {
      setStatusMessage('Please select a valid microservice instance.');
      return;
    }

    try {
      const res = await fetch('/api/gateway/chaos/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: targetInst.host,
          port: targetInst.port,
          faultType,
          delayMs: body?.delayMs,
          rate: body?.rate,
        }),
      });
      const data = await res.json();
      const msg = `[${targetInst.instanceId}] ${data.message || 'Fault injected'}`;
      setStatusMessage(msg);

      const newLog: AuditLog = {
        id: String(Date.now()),
        timestamp: new Date().toLocaleTimeString(),
        target: targetInst.instanceId,
        action: faultType === '/fail' ? 'Inject 500 Failure' : faultType === '/slow' ? 'Inject 10s Latency' : faultType === '/random-error' ? 'Inject 30% Errors' : 'Restore Instance',
        status: faultType === '/restore' ? 'RESTORED' : 'ACTIVE',
      };

      setAuditLogs((prev) => {
        const updated = [newLog, ...prev.slice(0, 9)];
        try {
          localStorage.setItem('nginz_chaos_audit_logs', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    } catch (err: any) {
      setStatusMessage(`Failed to inject fault on ${targetInst.instanceId}: ${err.message}`);
    }
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
    try {
      localStorage.removeItem('nginz_chaos_audit_logs');
    } catch {}
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
          Chaos Engineering Control Panel
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
          Safety-gated fault injection to test load balancing failover, circuit breakers, and graceful degradation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
        <div
          className={`breaker-module ${isArmed ? 'hazard-active' : ''}`}
          style={{
            borderColor: isArmed ? 'var(--status-offline)' : 'var(--border-tech)',
            transition: 'border-color 0.25s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: '6px',
              backgroundColor: isArmed ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-element)',
              border: `1px solid ${isArmed ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-tech)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`led-dot ${isArmed ? 'offline' : ''}`} />
              <span style={{ color: isArmed ? 'var(--status-offline)' : 'var(--text-dim)', fontWeight: 800, fontSize: '13px', letterSpacing: '0.04em' }}>
                {isArmed ? 'FAULT INJECTION LIVE' : 'SAFETY LATCH ENGAGED'}
              </span>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={isArmed}
                onChange={(e) => setIsArmed(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--status-offline)' }}
              />
              <span style={{ fontSize: '12px', fontWeight: 800, color: isArmed ? 'var(--status-offline)' : 'var(--text-head)' }}>
                ARM FAULT INJECTION
              </span>
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Target Microservice Instance
            </label>
            <select
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-element)',
                border: '1px solid var(--border-tech)',
                borderRadius: '6px',
                color: 'var(--text-head)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '13px',
              }}
            >
              {instances.map((inst) => (
                <option key={inst.instanceId} value={inst.instanceId}>
                  {`${inst.instanceId} (${inst.serviceName} - ${inst.host}:${inst.port})`}
                </option>
              ))}
            </select>
          </div>

          {statusMessage && (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px',
                backgroundColor: 'var(--bg-element)',
                border: '1px solid var(--border-tech)',
                borderRadius: '6px',
                color: 'var(--accent-amber)',
                fontSize: '12px',
                fontFamily: 'Space Mono, monospace',
              }}
            >
              {statusMessage}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              onClick={() => triggerChaos('/fail')}
              className={isArmed ? 'hazard-btn' : 'btn-neutral'}
              style={{
                padding: '12px',
                fontSize: '13px',
                fontWeight: 700,
                backgroundColor: isArmed ? '#ef4444' : undefined,
                color: isArmed ? '#ffffff' : undefined,
                borderColor: isArmed ? '#ef4444' : undefined,
              }}
            >
              Inject Failure (500)
            </button>

            <button
              onClick={() => triggerChaos('/slow', { delayMs: 10000 })}
              className={isArmed ? 'hazard-btn' : 'btn-neutral'}
              style={{ padding: '12px', fontSize: '13px', fontWeight: 700, backgroundColor: isArmed ? 'rgba(245, 158, 11, 0.2)' : undefined, color: isArmed ? 'var(--accent-amber)' : undefined }}
            >
              Inject 10s Latency
            </button>

            <button
              onClick={() => triggerChaos('/random-error', { rate: 0.3 })}
              className={isArmed ? 'hazard-btn' : 'btn-neutral'}
              style={{ padding: '12px', fontSize: '13px', fontWeight: 700, backgroundColor: isArmed ? 'rgba(168, 85, 247, 0.2)' : undefined, color: isArmed ? '#c084fc' : undefined }}
            >
              Inject 30% Errors
            </button>

            <button
              onClick={() => triggerChaos('/restore')}
              className="btn-neutral"
              style={{ padding: '12px', fontSize: '13px', fontWeight: 700, borderColor: 'var(--status-online)', color: 'var(--status-online)' }}
            >
              Restore Instance
            </button>
          </div>
        </div>

        <div className="breaker-module">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span className="mono-metric" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Recent Fault Injection Audit Trail
            </span>
            {auditLogs.length > 0 && (
              <button
                onClick={clearAuditLogs}
                className="btn-neutral"
                style={{ padding: '2px 8px', fontSize: '10px', color: 'var(--text-dim)' }}
              >
                Clear Log
              </button>
            )}
          </div>

          <div style={{ overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--border-tech)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Target Node</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => {
                  const isRestored = log.status === 'RESTORED';
                  return (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-head)' }}>{log.action}</div>
                        <div className="mono-metric" style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{log.timestamp}</div>
                      </td>
                      <td className="mono-metric" style={{ fontSize: '12px', color: 'var(--accent-amber)' }}>
                        {log.target}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`breaker-badge ${isRestored ? 'closed' : 'open'}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '24px', fontSize: '12px' }}>
                      No fault injection audit logs recorded yet. Toggle ARM switch and execute a fault action above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
