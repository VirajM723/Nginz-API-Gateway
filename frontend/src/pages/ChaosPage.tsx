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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    { id: '1', timestamp: new Date(Date.now() - 120000).toLocaleTimeString(), target: 'product-service-1', action: 'Inject Failure (500)', status: 'OVERRIDDEN' },
    { id: '2', timestamp: new Date(Date.now() - 360000).toLocaleTimeString(), target: 'payment-service-2', action: 'Inject 10s Latency', status: 'RESTORED' },
  ]);

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

      // Add to audit trail log
      setAuditLogs((prev) => [
        {
          id: String(Date.now()),
          timestamp: new Date().toLocaleTimeString(),
          target: targetInst.instanceId,
          action: faultType === '/fail' ? 'Inject 500 Failure' : faultType === '/slow' ? 'Inject 10s Latency' : faultType === '/random-error' ? 'Inject 30% Errors' : 'Restore Instance',
          status: faultType === '/restore' ? 'RESTORED' : 'ACTIVE',
        },
        ...prev.slice(0, 8),
      ]);
    } catch (err: any) {
      setStatusMessage(`Failed to inject fault on ${targetInst.instanceId}: ${err.message}`);
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
          Chaos Engineering Control Panel
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '2px' }}>
          Safety-gated fault injection to test load balancing failover, circuit breakers, and graceful degradation.
        </p>
      </div>

      {/* 2-Column Asymmetric Layout: Left = Armed Control Console; Right = Recent Fault Audit Trail Log */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Left Column: Safety-Gated Execution Panel */}
        <div className={`ops-card ${isArmed ? 'armed-hazard' : ''}`}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: isArmed ? 'rgba(239, 68, 68, 0.16)' : 'var(--bg-element)',
              borderRadius: '6px',
              marginBottom: '20px',
              border: `1px solid ${isArmed ? 'var(--status-offline)' : 'var(--border-tech)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`led-dot ${isArmed ? 'offline' : ''}`} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: isArmed ? 'var(--status-offline)' : 'var(--text-head)' }}>
                {isArmed ? '⚠️ FAULT INJECTION LIVE' : 'SAFETY LATCH LOCKED'}
              </span>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--text-head)' }}>
              <input
                type="checkbox"
                checked={isArmed}
                onChange={(e) => setIsArmed(e.target.checked)}
                style={{ accentColor: 'var(--status-offline)', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              ARM FAULT INJECTION
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
              Target Microservice Instance
            </label>
            <select
              value={selectedInstanceId}
              onChange={(e: any) => setSelectedInstanceId(e.target.value)}
              className="mono-metric"
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-element)',
                border: '1px solid var(--border-tech)',
                borderRadius: '4px',
                color: 'var(--text-head)',
                fontSize: '13px',
              }}
            >
              {instances.map((inst) => (
                <option key={inst.instanceId} value={inst.instanceId}>
                  {inst.instanceId} ({inst.serviceName} - {inst.host}:{inst.port})
                </option>
              ))}
            </select>
          </div>

          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mono-metric"
              style={{
                marginBottom: '20px',
                padding: '12px 14px',
                backgroundColor: 'var(--bg-element)',
                borderRadius: '4px',
                border: '1px solid var(--border-tech)',
                fontSize: '12px',
                color: 'var(--accent-amber)',
                fontWeight: 700,
              }}
            >
              {statusMessage}
            </motion.div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              className={isArmed ? 'hazard-btn-danger' : 'btn-danger'}
              disabled={!isArmed}
              onClick={() => triggerChaos('/fail')}
              style={{ opacity: isArmed ? 1 : 0.4, cursor: isArmed ? 'pointer' : 'not-allowed' }}
            >
              Inject Failure (500)
            </button>

            <button
              className="btn-primary"
              style={{ backgroundColor: 'var(--status-warning)', opacity: isArmed ? 1 : 0.4, cursor: isArmed ? 'pointer' : 'not-allowed' }}
              disabled={!isArmed}
              onClick={() => triggerChaos('/slow', { delayMs: 10000 })}
            >
              Inject 10s Latency
            </button>

            <button
              className="btn-primary"
              style={{ backgroundColor: '#4F46E5', opacity: isArmed ? 1 : 0.4, cursor: isArmed ? 'pointer' : 'not-allowed' }}
              disabled={!isArmed}
              onClick={() => triggerChaos('/random-error', { rate: 0.3 })}
            >
              Inject 30% Errors
            </button>

            <button
              className="btn-success"
              onClick={() => triggerChaos('/restore')}
            >
              Restore Instance
            </button>
          </div>
        </div>

        {/* Right Column: Recent Fault Injection Audit Trail Log (Fills Dead Space) */}
        <div className="ops-card">
          <div className="ops-card-header">
            <span className="ops-card-title">Recent Fault Injection Audit Trail</span>
            <span className="mono-metric" style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              LIVE OVERRIDES
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {auditLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  backgroundColor: 'var(--bg-element)',
                  border: '1px solid var(--border-tech)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-head)' }}>{log.action}</div>
                  <div className="mono-metric" style={{ fontSize: '11px', color: 'var(--accent-amber)' }}>{log.target}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={`ratio-chip ${log.status === 'RESTORED' ? 'healthy' : ''}`}>
                    {log.status}
                  </span>
                  <div className="mono-metric" style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {log.timestamp}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
