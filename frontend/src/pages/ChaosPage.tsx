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
      setStatusMessage('Safety Latch Engaged: Arm fault injection before running fault actions.');
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

  const actions = [
    { label: 'Inject failure', hint: 'HTTP 500', run: () => triggerChaos('/fail') },
    { label: 'Inject latency', hint: '10s delay', run: () => triggerChaos('/slow', { delayMs: 10000 }) },
    { label: 'Inject errors', hint: '30% rate', run: () => triggerChaos('/random-error', { rate: 0.3 }) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="page-body"
    >
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Resilience · Fault injection</div>
          <h1 className="page-title">Chaos control</h1>
          <p className="page-subtitle">
            Safety-gated fault injection for testing failover, circuit breakers and graceful degradation.
          </p>
        </div>
      </div>

      <div className="grid-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>
        <div className={`breaker-module ${isArmed ? 'hazard-active' : ''}`}>
          <div className={`arm-bar ${isArmed ? 'armed' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`led-dot ${isArmed ? 'offline' : 'idle'}`} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: isArmed ? 'var(--status-offline)' : 'var(--text-head)' }}>
                  {isArmed ? 'Fault injection armed' : 'Safety latch engaged'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {isArmed ? 'Actions below affect live instances.' : 'Arm to enable fault actions.'}
                </div>
              </div>
            </div>

            <label className="switch">
              <input type="checkbox" checked={isArmed} onChange={(e) => setIsArmed(e.target.checked)} />
              <span className="switch-track" />
              Arm
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="field-label">Target instance</label>
            <select
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="text-input mono-metric"
            >
              {instances.map((inst) => (
                <option key={inst.instanceId} value={inst.instanceId}>
                  {`${inst.instanceId} (${inst.host}:${inst.port})`}
                </option>
              ))}
            </select>
          </div>

          {statusMessage && (
            <div className="callout mono-metric" style={{ marginBottom: '20px', fontSize: '12px' }}>
              {statusMessage}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.run}
                disabled={!isArmed}
                className={isArmed ? 'btn-danger' : 'btn-neutral'}
                style={{ flexDirection: 'column', gap: '2px', padding: '12px 10px' }}
              >
                <span>{a.label}</span>
                <span className="mono-metric" style={{ fontSize: '11px', opacity: 0.75 }}>{a.hint}</span>
              </button>
            ))}
          </div>

          <button onClick={() => triggerChaos('/restore')} className="btn-neutral" style={{ width: '100%' }}>
            Restore instance
          </button>
        </div>

        <div className="breaker-module" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 14px' }}>
            <span className="ops-card-title">Audit trail</span>
            {auditLogs.length > 0 && (
              <button onClick={clearAuditLogs} className="btn-ghost btn-sm">
                Clear
              </button>
            )}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Target</th>
                <th style={{ textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => {
                const isRestored = log.status === 'RESTORED';
                return (
                  <tr key={log.id}>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-head)' }}>{log.action}</div>
                      <div className="mono-metric" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{log.timestamp}</div>
                    </td>
                    <td className="mono-metric" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {log.target}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`breaker-badge ${isRestored ? 'closed' : 'open'}`}>
                        {isRestored ? 'restored' : 'active'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '36px 24px' }}>
                    No fault injections recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
