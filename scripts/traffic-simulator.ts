import http from 'node:http';

interface TrafficConfig {
  targetUrl: string;
  rps: number;
  durationSeconds: number;
}

interface RequestResult {
  statusCode: number;
  latencyMs: number;
  degraded: boolean;
  success: boolean;
}

async function runTrafficSimulator() {
  const targetUrl = process.env.GATEWAY_URL || 'http://localhost:3000';
  const rps = Number(process.env.RPS || 50);
  const durationSeconds = Number(process.env.DURATION || 10);

  console.log(`🚀 Starting NginZ Traffic Simulator`);
  console.log(`   - Target: ${targetUrl}`);
  console.log(`   - Rate: ${rps} requests/sec`);
  console.log(`   - Duration: ${durationSeconds} seconds`);
  console.log(`---------------------------------------------`);

  const results: RequestResult[] = [];
  const endpoints = ['/health', '/api/products', '/api/users/1234', '/api/gateway/stats'];

  const startTime = Date.now();
  const endTime = startTime + durationSeconds * 1000;

  let requestCount = 0;

  const sendRequest = (): Promise<RequestResult> => {
    return new Promise((resolve) => {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const url = new URL(`${targetUrl}${endpoint}`);
      const startMs = Date.now();

      const req = http.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const latencyMs = Date.now() - startMs;
          let degraded = false;
          try {
            const json = JSON.parse(body);
            if (json.degraded) degraded = true;
          } catch {
            // non-json
          }

          resolve({
            statusCode: res.statusCode || 500,
            latencyMs,
            degraded,
            success: (res.statusCode || 500) < 400,
          });
        });
      });

      req.on('error', () => {
        resolve({
          statusCode: 503,
          latencyMs: Date.now() - startMs,
          degraded: true,
          success: false,
        });
      });

      req.end();
    });
  };

  const intervalMs = 1000 / rps;

  while (Date.now() < endTime) {
    const p = sendRequest().then((res) => results.push(res));
    requestCount++;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  // Wait a bit for pending responses
  await new Promise((r) => setTimeout(r, 1500));

  const successful = results.filter((r) => r.success).length;
  const degraded = results.filter((r) => r.degraded).length;
  const failed = results.filter((r) => !r.success).length;
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  console.log(`\n📊 Simulation Completed:`);
  console.log(`   - Total Sent: ${requestCount}`);
  console.log(`   - Received: ${results.length}`);
  console.log(`   - Successful (2xx/3xx): ${successful} (${((successful / results.length) * 100).toFixed(1)}%)`);
  console.log(`   - Degraded Responses: ${degraded}`);
  console.log(`   - Failed Responses: ${failed}`);
  console.log(`   - Latency Avg: ${avgLatency.toFixed(2)} ms`);
  console.log(`   - Latency P95: ${p95} ms`);
  console.log(`   - Latency P99: ${p99} ms`);
}

runTrafficSimulator();
