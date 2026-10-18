# NginZ API Gateway & Distributed Microservices Platform — Memory & Architecture Guide

> **System Memory & Operations Manual**  
> **Repository**: [https://github.com/VirajM723/Nginz-API-Gateway.git](https://github.com/VirajM723/Nginz-API-Gateway.git)  
> **Live Web Console (Frontend)**: [https://nginz-api-gateway-frontend.vercel.app/](https://nginz-api-gateway-frontend.vercel.app/)  
> **Live API Gateway (Backend)**: [https://nginz-api-gateway.onrender.com/](https://nginz-api-gateway.onrender.com/)  

---

## 1. Executive Summary & Architecture Overview

**NginZ** is an enterprise-grade, cloud-native API Gateway and microservice resilience platform written in TypeScript and Node.js. It operates as the authoritative edge ingress controller for distributed microservices, providing high-performance request routing, cryptographic token validation, atomic token-bucket rate limiting, service discovery with active HTTP probing, multi-state circuit breaking, graceful degradation fallbacks, and real-time chaos engineering.

### Architecture Topology

```
                                    +-----------------------------------------+
                                    |         Client / Ingress Inflow         |
                                    +-----------------------------------------+
                                                         |
                                 +-----------------------+-----------------------+
                                 |                                               |
                                 v                                               v
                   [ Vercel CDN Static Edge ]                       [ Nginx Reverse Proxy: 8080 ]
                  React 18 SPA Control Plane                           Local Ingress & Static Host
                                 |                                               |
                                 +-----------------------+-----------------------+
                                                         |
                                                         v
                                      +-------------------------------------+
                                      |     Express API Gateway (Port 3000) |
                                      +-------------------------------------+
                                      |  1. Request ID (UUIDv4) Tracing     |
                                      |  2. Prometheus & Telemetry Counter  |
                                      |  3. Redis Token Bucket Rate Limiter |
                                      |  4. JWT Auth Filter (Public Bypass) |
                                      |  5. Multi-Domain Circuit Breakers   |
                                      |  6. Dynamic Reverse Proxy & LB      |
                                      +-------------------------------------+
                                         |               |               |
               +-------------------------+               |               +-------------------------+
               |                                         |                                         |
               v                                         v                                         v
   +-----------------------+                 +-----------------------+                 +-----------------------+
   |   PostgreSQL Cloud    |                 |      Redis Cloud      |                 |    RabbitMQ Cloud     |
   | (Supabase / Aiven)    |                 |   (Redis Enterprise)  |                 |      (CloudAMQP)      |
   | Relational DB Tables  |                 | Rate Limiters, State, |                 | Async Payment Worker  |
   | Port 5432 / Pooler    |                 | Discovery Heartbeats  |                 | Queue Fallbacks       |
   +-----------------------+                 +-----------------------+                 +-----------------------+
                                                         |
                   +-------------------------------------+-------------------------------------+
                   |                     Microservices Cluster (10 Instances)                   |
                   |                                                                           |
                   |  [auth-service-1:3001]     [auth-service-2:3001]     (Authentication)     |
                   |  [user-service-1:3002]     [user-service-2:3002]     (User Profiles)      |
                   |  [product-service-1:3003]  [product-service-2:3003]  (Product Catalog)    |
                   |  [order-service-1:3004]    [order-service-2:3004]    (Order Processing)   |
                   |  [payment-service-1:3005]  [payment-service-2:3005]  (Payments Pipeline)  |
                   +---------------------------------------------------------------------------+
```

---

## 2. Core Features & Operational Mechanics

### 2.1 Dynamic Reverse Proxying & Load Balancing (`dynamicProxy.ts`)
- **Route Mapping**: Translates path prefixes into service domains:
  - `/api/auth/*` ➔ `auth-service` (ports 3001)
  - `/api/users/*` ➔ `user-service` (ports 3002)
  - `/api/products/*` ➔ `product-service` (ports 3003)
  - `/api/orders/*` ➔ `order-service` (ports 3004)
  - `/api/payments/*` ➔ `payment-service` (ports 3005)
- **Header Propagation**:
  - `X-Request-ID`: Distributed correlation ID passed from edge through microservices.
  - `X-Served-By`: Indicates the precise node instance that handled the request (e.g., `product-service-2`).
  - `X-Failed-Instances`: If an upstream node timed out or threw a 500 error, the gateway records the failed nodes before failing over to the next healthy node in the round-robin pool.
- **Failover Loop**: Automatically queries untried instances if an instance fails with $\ge 500$ or network error, preventing transient container errors from bubbling up to consumers.

### 2.2 Redis Token Bucket Rate Limiting (`rateLimiter.ts`)
- **Atomic Lua Scripting**: Executes atomic token decrement and replenishment within Redis memory to eliminate race conditions across clustered gateway workers.
- **Configurable Parameters**:
  - `maxTokens`: Burst token capacity (default: `100`).
  - `refillRate`: Tokens restored per refill cycle (default: `100`).
  - `windowMs`: Time period for refill in milliseconds (default: `60000ms`).
- **HTTP 429 Status**: Enforces strict throttling when token bucket is exhausted, returning `Retry-After` header and JSON error payload.

### 2.3 Resilient Multi-State Circuit Breaker (`circuitBreaker.ts`)
The NginZ circuit breaker state machine protects downstream services from cascade failure:

```
              +------------------------------------------+
              |                  CLOSED                  | <----+
              | Nominal State: All requests flow through |      |
              +------------------------------------------+      |
                                   |                            |
                Failure threshold reached (5/5)                 |
                AND all domain instances failed                 | Trial probe
                                   |                            | request
                                   v                            | succeeds
              +------------------------------------------+      | (200 OK)
              |                   OPEN                   |      |
              |   Tripped: Requests routed to fallback   |      |
              +------------------------------------------+      |
                                   |                            |
                     At least 1 instance restored               |
                     AND traffic received                       |
                                   |                            |
                                   v                            |
              +------------------------------------------+      |
              |                HALF_OPEN                 | -----+
              |   Trial Probe: Evaluates restored node   |
              +------------------------------------------+
                                   |
                                   | Trial probe fails (5xx / Timeout)
                                   v
                             (Re-trips to OPEN)
```

- **Domain Isolation**: Breakers are isolated per microservice domain (`auth-service`, `user-service`, `product-service`, `order-service`, `payment-service`).
- **Traffic-Driven Tripping**: Breakers will **only** trip to `OPEN` when traffic (such as a load test) actively hits a domain where **all** instances have failed.
- **Restoration & Trial Testing**: If tripped `OPEN`, the breaker stays `OPEN` until at least 1 instance is restored and healthy traffic succeeds through a `HALF_OPEN` trial probe.
- **Manual Override**: The console includes a **Reset All Breakers** control to forcefully return all domains to `CLOSED` (`0/5 FAILURES`).

### 2.4 Graceful Degradation & Fallbacks
When a circuit breaker trips `OPEN` or all instances in a domain are down:
1. **Product Service Fallback**: Routes requests to Redis distributed cache (`cache:products`). Returns `200 OK` with `{ degraded: true, source: 'cache', data: [...] }`.
2. **Payment Service Fallback**: Asynchronously enqueues transactions to RabbitMQ message broker for worker processing. Returns `202 Accepted` with `{ degraded: true, status: 'PAYMENT_PENDING' }` and header `X-Degraded-Payment: true`.
3. **Core Services Fallback**: Non-degradable dependencies (e.g. Auth, Users) fail-closed with `503 Service Unavailable`, shielding database state from corruption.

### 2.5 Chaos Engineering Control Panel (`chaosRoutes.ts`)
- **Safety Interlock**: Physical `ARM FAULT INJECTION` safety toggle switch prevents accidental fault triggers during operational monitoring.
- **Fault Types**:
  - `/fail`: Injects immediate HTTP 500 internal server crash.
  - `/slow`: Injects 10,000ms artificial latency delay to test timeout handling.
  - `/random-error`: Injects 30% random error rate to test retry resilience.
  - `/restore`: Resets microservice instance to healthy `UP` state.
- **Local Persistence**: Audit trail logs are stored in browser `localStorage` (`nginz_chaos_audit_logs`) and survive page reloads and tab closures.

### 2.6 Traffic Load & Latency Simulator (`trafficSimulator.ts`)
- **High-Concurrency Generator**: Emulates synthetic ingress traffic at 10, 50, 100, 500, or 1000 RPS.
- **Multi-IP Emulation**: Rotates across 5 distinct client IP addresses (`198.51.100.10` to `198.51.100.50`) to validate per-IP rate limiter fairness.
- **Metrics Aggregation**: Dynamically calculates Total Ingress, 2xx Allowed, 429 Rate Limited, 5xx Failed, Degraded Fallbacks, Avg Latency, P95, and P99 percentiles.

---

## 3. User Interface Tour & Visual Artifacts

The NginZ operator console uses a dark interface: a near-black canvas, charcoal panels with 1px hairline borders, Inter for interface text and JetBrains Mono for IDs and metrics, and a single lavender accent (`#5e6ad2`) reserved for the brand mark, primary actions and focus rings. Status colour (green / amber / red) is used only for functional health state, as small dots and pills. All pages poll the gateway in real time.

### 3.1 Overview Page (Network Operations Center)
The centralized command view provides instantaneous cluster visibility, high-level gateway metrics, human-readable uptime, and an interactive 10-node topology matrix with live telemetry hover tooltips.

![NginZ Overview Dashboard](screenshots/overview.png)

- **Header Status Pill**: Breadcrumb on the left; on the right a pill computing the healthy instance ratio (e.g., `● Cluster healthy 10/10` or `● Cluster degraded 8/10` with a red dot).
- **Headline Metrics**: Availability, gateway uptime, registered domains and failing instances.
- **Instance Matrix**: All 10 microservice nodes, one column per domain. Hovering a tile shows memory and uptime in the card header.
- **Request Pipeline**: The four-step request lifecycle: *Edge Ingress ➔ Security (JWT + rate limit) ➔ Discovery ➔ Resilience*, beside a dependency status list (Redis, RabbitMQ, PostgreSQL, JWT).

---

### 3.2 Service Discovery Registry
The Service Discovery console renders a real-time ledger of all microservice nodes registered in the Redis registry.

![Microservice Discovery Registry](screenshots/services.png)

- **Active HTTP Probing**: The Gateway background probe interrogates `/health` on every container every 5 seconds.
- **Frozen Timestamp Behavior**: When an instance goes `DOWN`, its heartbeat timestamp freezes at the last moment it was healthy, displaying `FROZEN (OFFLINE)` and `TIMEOUT`.
- **Search Filtering**: Filter nodes instantly by service domain, container ID, host, port, or protocol.

---

### 3.3 Circuit Breaker Protection Controls
One card per microservice domain tracking its isolated fault tolerance state.

![Circuit Breakers Page](screenshots/circuit-breakers.png)

- **State Pills**: Status pills for `CLOSED` (green dot), `OPEN` (red, card border also turns red), and `HALF_OPEN` (amber trial).
- **Failure Threshold Meters**: Thin meter bars tracking failure accumulation (`0/5` to `5/5`).
- **Reset All Breakers**: Instant administrative trigger to restore nominal routing across all 5 domains.

---

### 3.4 Chaos Engineering Control Panel
Safety-gated fault injection suite enabling site reliability engineers (SREs) to stress test failover and recovery behavior.

![Chaos Engineering Control Panel](screenshots/chaos.png)

- **Arm Switch**: A toggle that keeps the fault buttons disabled until it is turned on; once armed, the status bar and panel border turn red.
- **Target Selection**: Dropdown selecting target container (e.g., `auth-service-1`, `payment-service-2`).
- **Inject Actions**: Buttons for 500 Failure, 10s Latency and 30% Error Rate, plus a separate Restore instance action.
- **Persistent Audit Trail**: Records target node, action type, timestamp, and resulting status in persistent storage.

---

### 3.5 Traffic Load & Latency Simulator
Synthetic load generator verifying rate limiting, round-robin load distribution, and fallback degradation under sustained traffic.

![Traffic Simulator Page](screenshots/simulator.png)

- **RPS & Duration Controls**: Segmented control for 10 RPS up to 1000 RPS, plus a duration input.
- **Request Stream**: Real-time monospace log of every request with timestamp, client IP, target instance, HTTP status, and round-trip latency.
- **Latency Percentile Meters**: Real-time computation of Average Latency, P95, and P99 metrics.

---

### 3.6 Rate Limiter Policy Configuration
Operator policy configuration panel to adjust distributed Redis Token Bucket rules without restarting the gateway.

![Rate Limiter Configuration](screenshots/rate-limiter.png)

- **Policy Inputs**: Adjust Max Burst Tokens (`10` to `1,000`), Refill Rate, and Window Duration.
- **Policy Presets**:
  - *Standard*: Balanced protection (100 tokens / 60s).
  - *High Throughput*: Production burst mode (1000 tokens / 60s).
  - *Strict Auth*: Aggressive brute-force protection (10 tokens / 60s).
- **Bucket Preview**: Meter and plain-language summary of the current burst and refill policy.

---

### 3.7 Infrastructure Monitoring: Prometheus & Grafana

#### Prometheus Server (Port 9090)
Scrapes Prometheus metrics from `/metrics` across Gateway and microservices. Tracks counter metrics (`http_requests_total`, `active_connections`), latency histograms (`http_request_duration_ms`), and rate limit rejections.

![Prometheus Monitoring Server](screenshots/prometheus.png)

#### Grafana Telemetry Dashboard (Port 3001)
Pre-configured visual dashboards graphing cluster throughput (RPS), error rates (4xx/5xx), P95/P99 latency distribution, and container resource utilization.

![Grafana Dashboard](screenshots/grafana.png)

---

## 4. API Specification & Endpoints

### Gateway System Endpoints (Port 3000)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/` | Gateway cluster info, endpoints index, and uptime metadata | No |
| `GET` | `/health` | Deep health probe (PostgreSQL, Redis, RabbitMQ dependencies) | No |
| `GET` | `/metrics` | Prometheus exposition endpoint for telemetry scraping | No |
| `GET` | `/api/gateway/stats` | Consolidated cluster health, uptime, and node counts | No |
| `GET` | `/api/gateway/services` | Active service discovery registry topology | No |
| `GET` | `/api/gateway/circuit-breakers` | Current state of all 5 domain circuit breakers | No |
| `POST` | `/api/gateway/circuit-breakers/reset`| Administratively reset all circuit breakers to CLOSED | No |
| `GET` | `/api/gateway/rate-limiter` | Current active Redis token bucket configuration | No |
| `POST` | `/api/gateway/rate-limiter` | Update active rate limiter parameters | No |
| `POST` | `/api/gateway/chaos/trigger` | Inject or restore faults on targeted microservice instance | No |
| `POST` | `/api/gateway/traffic/start` | Launch synthetic traffic simulation | No |
| `POST` | `/api/gateway/traffic/stop` | Terminate running traffic simulation | No |
| `GET` | `/api/gateway/traffic/results` | Fetch accumulated traffic simulation metrics and logs | No |

### Microservices Reverse Proxy Endpoints

| Method | Ingress Route | Target Service | Upstream Port | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | `auth-service` | 3001 | User account registration |
| `POST` | `/api/auth/login` | `auth-service` | 3001 | Returns HMAC SHA-256 JWT token |
| `GET` | `/api/users/:id` | `user-service` | 3002 | Fetch user account profile (Requires JWT) |
| `GET` | `/api/products` | `product-service` | 3003 | List catalog products (Fallback to Redis cache) |
| `POST` | `/api/orders` | `order-service` | 3004 | Create new customer purchase order |
| `POST` | `/api/payments` | `payment-service` | 3005 | Process charge (Fallback to RabbitMQ worker queue) |

---

## 5. Deployment & Cloud Architecture Reference

### 5.1 Cloud Production Setup (100% Free / Zero Credit Card)
- **Frontend SPA**: Hosted on [Vercel](https://nginz-api-gateway-frontend.vercel.app/).
  - Configured with `vercel.json` rewrites proxying `/api/*` to the Render backend, preventing CORS and mixed-content issues.
- **Backend API Gateway**: Hosted on [Render](https://nginz-api-gateway.onrender.com/).
  - Docker container running Node 20 LTS Alpine.
  - Startup resilience configured so missing/paused message brokers do not cause fatal container crash loops.
- **Relational Database**: [Supabase](https://supabase.com/) / [Aiven](https://aiven.io/) PostgreSQL.
  - Connected via IPv4 Supabase Connection Pooler (`aws-0-[region].pooler.supabase.com:5432`) with SSL enabled.
- **Distributed Cache & State**: [Redis Cloud](https://redis.io/) Enterprise.
- **Asynchronous Message Broker**: [CloudAMQP](https://www.cloudamqp.com/) RabbitMQ (Little Lemur).

### 5.2 Environment Variables Reference (`.env`)

```ini
# Service Ports & Environment
PORT=3000
NODE_ENV=production
JWT_SECRET=nginz_super_secret_jwt_key_2026_production_grade

# Cloud Database & Infrastructure Connection URIs
POSTGRES_URI=postgresql://postgres.[REF]:[PASS]@[POOLER-HOST]:5432/postgres?sslmode=require
REDIS_URI=redis://default:[PASS]@[REDIS-HOST]:[PORT]
RABBITMQ_URI=amqps://[USER]:[PASS]@[AMQP-HOST]/[VHOST]

# Gateway Traffic & Balancing Configuration
LB_STRATEGY=round-robin
RATE_LIMIT_MAX_TOKENS=100
RATE_LIMIT_REFILL_RATE=100
RATE_LIMIT_WINDOW_MS=60000
```

---

## 6. Local Development & Docker Runbook

### Run Full 18-Container Stack Locally
To run all 10 microservices, Gateway, Nginx, Redis, PostgreSQL, RabbitMQ, Prometheus, and Grafana on your local workstation:

```bash
# 1. Install workspace dependencies
npm install

# 2. Build TypeScript across all shared packages and services
npm run build

# 3. Launch complete Docker Compose cluster
docker compose up -d --build

# 4. Apply database schema and seed users
npm run db:apply-schema
npm run db:seed
```

### Local Ports Mapping
- **Nginx Web Dashboard**: `http://localhost:8080`
- **Express API Gateway**: `http://localhost:3000`
- **Prometheus Monitoring**: `http://localhost:9090`
- **Grafana Dashboards**: `http://localhost:3001` (Credentials: `admin` / `admin`)
- **RabbitMQ Management**: `http://localhost:15672` (Credentials: `guest` / `guest`)
- **PostgreSQL Database**: `localhost:5432`
- **Redis Server**: `localhost:6379`
