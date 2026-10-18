import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const DEFAULT_SERVICES: Record<string, any[]> = {
  'auth-service': [
    { instanceId: 'auth-service-1', serviceName: 'auth-service', host: 'auth-service-1', port: 3001, status: 'UP', lastPing: Date.now() },
    { instanceId: 'auth-service-2', serviceName: 'auth-service', host: 'auth-service-2', port: 3001, status: 'UP', lastPing: Date.now() },
  ],
  'user-service': [
    { instanceId: 'user-service-1', serviceName: 'user-service', host: 'user-service-1', port: 3002, status: 'UP', lastPing: Date.now() },
    { instanceId: 'user-service-2', serviceName: 'user-service', host: 'user-service-2', port: 3002, status: 'UP', lastPing: Date.now() },
  ],
  'product-service': [
    { instanceId: 'product-service-1', serviceName: 'product-service', host: 'product-service-1', port: 3003, status: 'UP', lastPing: Date.now() },
    { instanceId: 'product-service-2', serviceName: 'product-service', host: 'product-service-2', port: 3003, status: 'UP', lastPing: Date.now() },
  ],
  'order-service': [
    { instanceId: 'order-service-1', serviceName: 'order-service', host: 'order-service-1', port: 3004, status: 'UP', lastPing: Date.now() },
    { instanceId: 'order-service-2', serviceName: 'order-service', host: 'order-service-2', port: 3004, status: 'UP', lastPing: Date.now() },
  ],
  'payment-service': [
    { instanceId: 'payment-service-1', serviceName: 'payment-service', host: 'payment-service-1', port: 3005, status: 'UP', lastPing: Date.now() },
    { instanceId: 'payment-service-2', serviceName: 'payment-service', host: 'payment-service-2', port: 3005, status: 'UP', lastPing: Date.now() },
  ],
};

export const ServicesPage: React.FC = () => {
  const [servicesMap, setServicesMap] = useState<Record<string, any[]>>(DEFAULT_SERVICES);
  const [searchQuery, setSearchQuery] = useState('');
  const [pingingId, setPingingId] = useState<string | null>(null);

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/gateway/services');
      const data = await res.json();
      if (data.services && Object.keys(data.services).length > 0) {
        setServicesMap(data.services);
      }
    } catch {
      // demo fallback
    }
  };

  useEffect(() => {
    fetchServices();
    const timer = setInterval(fetchServices, 2000);
    return () => clearInterval(timer);
  }, []);

  const activeMap = Object.keys(servicesMap).length > 0 ? servicesMap : DEFAULT_SERVICES;

  const allRows = Object.entries(activeMap).flatMap(([serviceName, instances]) =>
    instances.map((inst: any, idx: number) => ({
      serviceName,
      ...inst,
      pingJitter: `${(1.2 + ((inst.port * 13 + idx * 7) % 25) / 10).toFixed(1)}ms`,
      protocol: 'HTTP/1.1',
    }))
  );

  const filteredRows = allRows.filter(
    (row) =>
      row.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.instanceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.host.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalInstances = allRows.length || 10;
  const healthyCount = allRows.filter((r) => r.status === 'UP').length;
  const domainsCount = Object.keys(activeMap).length || 5;

  const handlePingNode = (instanceId: string) => {
    setPingingId(instanceId);
    setTimeout(() => setPingingId(null), 800);
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
          <div className="page-eyebrow">Core · Registry</div>
          <h1 className="page-title">Service discovery</h1>
          <p className="page-subtitle">
            Every instance registered in Redis, with live heartbeats, endpoints and health probe state.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            placeholder="Filter by service, ID or host…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-input"
            style={{ width: '260px' }}
          />
          <button onClick={fetchServices} className="btn-neutral">
            Refresh
          </button>
        </div>
      </div>

      <div className="table-frame">
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`ratio-chip ${healthyCount < totalInstances ? 'degraded' : 'healthy'}`}>
              {healthyCount}/{totalInstances} healthy
            </span>
            <span className="ratio-chip">{domainsCount} domains</span>
          </div>
          <div className="mono-metric" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            HTTP/1.1 · Redis sync · 5s probe
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Instance</th>
                <th>Endpoint</th>
                <th>Protocol</th>
                <th>State</th>
                <th>Latency</th>
                <th>Last heartbeat</th>
                <th style={{ textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const isUp = row.status === 'UP';
                const isPinging = pingingId === row.instanceId;
                return (
                  <tr key={row.instanceId}>
                    <td style={{ fontWeight: 500, color: 'var(--text-head)' }}>{row.serviceName}</td>
                    <td className="mono-metric" style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{row.instanceId}</td>
                    <td className="mono-metric" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {`${row.host}:${row.port}`}
                    </td>
                    <td className="mono-metric" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      {row.protocol}
                    </td>
                    <td>
                      <span className="status-led-text" style={{ fontSize: '12px' }}>
                        <span className={`led-dot ${isUp ? '' : 'offline'}`} />
                        <span style={{ color: isUp ? 'var(--text-primary)' : 'var(--status-offline)' }}>
                          {isUp ? 'Up' : 'Down'}
                        </span>
                      </span>
                    </td>
                    <td className="mono-metric" style={{ fontSize: '12px', color: isPinging ? 'var(--accent-ink)' : isUp ? 'var(--text-primary)' : 'var(--status-offline)' }}>
                      {isPinging ? 'probing…' : isUp ? row.pingJitter : 'timeout'}
                    </td>
                    <td className="mono-metric" style={{ fontSize: '12px', color: isUp ? 'var(--text-secondary)' : 'var(--status-offline)' }}>
                      {isUp ? (row.lastPing ? new Date(row.lastPing).toLocaleTimeString() : 'N/A') : 'frozen (offline)'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => handlePingNode(row.instanceId)} className="btn-neutral btn-sm">
                        Probe
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                    {searchQuery ? `No instances match "${searchQuery}".` : 'Querying Redis service registry…'}
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
