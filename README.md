# NginZ: Cloud-Native API Gateway & Infrastructure Platform

NginZ is a production-grade API gateway monorepo built with Node.js, Express, TypeScript, Nginx, Redis, PostgreSQL, and RabbitMQ. It serves as an edge ingress, load balancer, rate limiter, circuit breaker, and chaos engineering control plane for microservices.

The system includes a dedicated NOC operator dashboard running on port 8080, backed by high-throughput gateway infrastructure on port 3000, Prometheus metrics collection on port 9090, and Grafana telemetry visualization on port 3001.

---

## System Architecture

The monorepo contains 10 microservice node instances running behind the gateway:

- **Nginx Edge Ingress (Port 8080)**: Serves the static React SPA dashboard and proxies API traffic (`/api/*`) to the Gateway.
- **Express API Gateway (Port 3000)**: Handles request routing, HMAC SHA-256 JWT validation, rate limiting, and discovery.
- **Prometheus Monitoring Server (Port 9090)**: Scrapes metrics every 5 seconds across all 6 service target endpoints.
- **Grafana Telemetry Dashboard (Port 3001)**: Visualizes PromQL metrics, latency percentiles, throughput RPS, and container health.
- **Redis Container (Port 6379)**: Manages atomic Lua token bucket rate limit counters and live microservice registry heartbeats.
- **PostgreSQL Container (Port 5432)**: Relational database instance for application domain data.
- **RabbitMQ Container (Ports 5672/15672)**: Asynchronous message broker for payment queue fallbacks.
- **Microservices (10 Instances across 5 Domains)**:
  - Auth Service (2 instances: ports 3001)
  - User Service (2 instances: ports 3002)
  - Product Service (2 instances: ports 3003)
  - Order Service (2 instances: ports 3004)
  - Payment Service (2 instances: ports 3005)

---

## User Interface & Infrastructure Tour

### 1. Overview Page
The main dashboard summary displays live system status, node availability ratios, human-scale gateway uptime, an interactive 10-node topology matrix with telemetry hover tooltips, key metric counters, and an ingress pipeline sequence flow.

![Overview Page](screenshots/overview.png)

---

### 2. Microservice Discovery Registry
Full-width data console table tracking active microservice nodes, Docker container host endpoints, health status, and live ping latencies with real-time filter searching.

![Service Discovery Registry](screenshots/services.png)

---

### 3. Circuit Breaker Protection Controls
Industrial state machine modules displaying breaker states (CLOSED, OPEN, HALF_OPEN), healthy probe counts, and clean visual fault load progress bars.

![Circuit Breakers Page](screenshots/circuit-breakers.png)

---

### 4. Chaos Engineering Control Panel
Safety-gated fault injection panel with a physical ARM FAULT INJECTION safety toggle switch, target node selector, hazard warning mode, and recent fault audit trail logs.

![Chaos Engineering Page](screenshots/chaos.png)

---

### 5. Traffic Load Simulator
Synthetic load generator with configurable RPS and duration parameters, paired with a live request log stream featuring a terminal prompt empty state.

![Traffic Simulator Page](screenshots/simulator.png)

---

### 6. Rate Limiter Configuration
Focused Policy settings panel allowing operators to dynamically adjust Redis Token Bucket parameters, test quick presets (High Throughput, Strict Auth, Standard), and preview token capacity bars.

![Rate Limiter Configuration Page](screenshots/rate-limiter.png)

---

### 7. Gateway API Endpoint (Port 3000)
Direct Express Gateway root endpoint delivering platform metadata, discovery state, registered service endpoints, and platform uptime in JSON.

![Gateway API JSON Endpoint](screenshots/gateway-api.png)

---

### 8. Prometheus Monitoring Server (Port 9090)
Prometheus time series server configured to scrape `/metrics` endpoints across all Gateway and microservice target instances. Supports raw PromQL evaluation, expression graphing, and target health verification.

![Prometheus Monitoring Server](screenshots/prometheus.png)

---

### 9. Grafana Telemetry Dashboard (Port 3001)
Grafana visualization interface provisioned with Prometheus as the primary datasource. Allows system administrators to execute PromQL queries, analyze HTTP throughput (RPS), track P95/P99 latencies, and monitor process memory/CPU consumption.

- **Default Credentials**: Username: `admin` | Password: `admin`

![Grafana Telemetry Dashboard](screenshots/grafana.png)

---

## Quick Start Guide

### Prerequisites
- Docker Engine 24+ and Docker Compose v2
- Node.js 18+ and npm 9+

### Environment Setup
Copy `.env` configuration file in the project root:

```bash
PORT=3000
NODE_ENV=development
JWT_SECRET=nginz_super_secret_jwt_key_2026_production_grade

POSTGRES_URI=postgresql://postgres:postgrespassword@postgres:5432/nginz
REDIS_URI=redis://redis:6379
RABBITMQ_URI=amqp://guest:guest@rabbitmq:5672

LB_STRATEGY=round-robin
RATE_LIMIT_MAX_TOKENS=100
RATE_LIMIT_REFILL_RATE=100
RATE_LIMIT_WINDOW_MS=60000
```

### Running Locally with Docker Compose

1. Build packages and launch container stack:
```bash
npm run build
docker-compose up -d --build
```

2. Check container status:
```bash
docker-compose ps
```

3. Access endpoints:
- Dashboard: http://localhost:8080
- API Gateway: http://localhost:3000
- Prometheus Metrics: http://localhost:9090
- Grafana Dashboard: http://localhost:3001 (Credentials: `admin` / `admin`)
- RabbitMQ Management: http://localhost:15672

---

## API Cheat Sheet

- `GET http://localhost:8080/api/gateway/stats` - Cluster health and availability ratio
- `GET http://localhost:8080/api/gateway/services` - Discovered service instances
- `GET http://localhost:8080/api/gateway/circuit-breakers` - Breaker state machine status
- `POST http://localhost:8080/api/gateway/chaos/trigger` - Trigger fault override on instance
- `POST http://localhost:8080/api/gateway/rate-limiter` - Update Redis token bucket settings

---

## Verification & Testing

Verify system health via curl:

```bash
curl -i http://localhost:8080/api/gateway/stats
```

Expected Output:
```json
{
  "status": "UP",
  "gatewayUptime": 1024,
  "activeServices": 5,
  "totalInstances": 10,
  "totalHealthyInstances": 10,
  "totalFailedInstances": 0
}
```
