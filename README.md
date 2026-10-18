# NginZ: Cloud-Native API Gateway & Infrastructure Platform

NginZ is a production-grade API gateway monorepo built with Node.js, Express, TypeScript, Nginx, Redis, PostgreSQL, and RabbitMQ. It serves as an edge ingress, load balancer, rate limiter, circuit breaker, and chaos engineering control plane for microservices.

---

## Live Cloud Deployments

> **Live Operator Console (Frontend)**: [https://nginz-api-gateway-frontend.vercel.app/](https://nginz-api-gateway-frontend.vercel.app/)  
> **Live API Gateway Service (Backend)**: [https://nginz-api-gateway.onrender.com/](https://nginz-api-gateway.onrender.com/)

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
The main dashboard shows availability, gateway uptime, registered domains and failing instances as headline metrics, a 10-node instance matrix laid out one column per service domain (hover for memory and uptime), the four-step request pipeline, and dependency status.

![Overview Page](screenshots/overview.png)

---

### 2. Microservice Discovery Registry
Full-width registry table tracking every microservice instance, its host endpoint, health state, probe latency and last heartbeat, with instant filtering.

![Service Discovery Registry](screenshots/services.png)

---

### 3. Circuit Breaker Protection Controls
One card per service domain showing breaker state (CLOSED, OPEN, HALF_OPEN) as a status pill, a failure threshold meter, recovery timeout and probe counts.

![Circuit Breakers Page](screenshots/circuit-breakers.png)

---

### 4. Chaos Engineering Control Panel
Safety-gated fault injection: fault actions stay disabled until the Arm switch is turned on, then a target instance can be given a 500 failure, 10s latency or 30% error rate, or restored. Every action is recorded in the audit trail.

![Chaos Engineering Page](screenshots/chaos.png)

---

### 5. Traffic Load Simulator
Synthetic load generator with a segmented RPS control and duration input, live counters, latency percentiles, and a per-instance request stream.

![Traffic Simulator Page](screenshots/simulator.png)

---

### 6. Rate Limiter Configuration
Policy form for adjusting the Redis token bucket at runtime, one-click presets (Standard, High throughput, Strict auth), and a live bucket preview.

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
