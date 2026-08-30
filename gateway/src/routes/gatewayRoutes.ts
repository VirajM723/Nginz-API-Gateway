import http from 'node:http';
import { Router, Request, Response } from 'express';
import { discovery } from '../services/discovery';
import { circuitBreaker } from '../services/circuitBreaker';
import { trafficSimulator } from '../services/trafficSimulator';
import { asyncHandler } from '@nginz/middleware';

const router = Router();

router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const services = discovery.getAllServices();
  let totalInstances = 0;
  let totalHealthy = 0;
  let totalFailed = 0;
  let activeServicesCount = 0;

  for (const list of Object.values(services)) {
    totalInstances += list.length;
    const healthyInService = list.filter((inst) => inst.status === 'UP').length;
    const failedInService = list.filter((inst) => inst.status === 'DOWN').length;
    totalHealthy += healthyInService;
    totalFailed += failedInService;
    if (healthyInService > 0) activeServicesCount += 1;
  }

  res.json({
    status: totalHealthy > 0 ? 'UP' : 'DOWN',
    gatewayUptime: process.uptime(),
    activeServices: activeServicesCount,
    totalInstances,
    totalHealthyInstances: totalHealthy,
    totalFailedInstances: totalFailed,
    timestamp: new Date().toISOString(),
  });
}));

router.get('/services', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    services: discovery.getAllServices(),
  });
}));

router.get('/circuit-breakers', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    breakers: circuitBreaker.getAllStates(),
  });
}));

router.get('/rate-limit', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    maxTokens: Number(process.env.RATE_LIMIT_MAX_TOKENS || 100),
    refillRate: Number(process.env.RATE_LIMIT_REFILL_RATE || 100),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  });
}));

router.put('/rate-limit', asyncHandler(async (req: Request, res: Response) => {
  const { maxTokens, refillRate } = req.body;
  if (maxTokens) process.env.RATE_LIMIT_MAX_TOKENS = String(maxTokens);
  if (refillRate) process.env.RATE_LIMIT_REFILL_RATE = String(refillRate);

  res.json({
    message: 'Rate limit configuration updated dynamically',
    maxTokens: process.env.RATE_LIMIT_MAX_TOKENS,
    refillRate: process.env.RATE_LIMIT_REFILL_RATE,
  });
}));

router.post('/traffic/start', asyncHandler(async (req: Request, res: Response) => {
  const { rps, durationSeconds } = req.body;
  const result = trafficSimulator.startSimulation(
    Number(rps || 50),
    Number(durationSeconds || 30)
  );
  res.json({
    message: 'Traffic simulator started successfully',
    simulation: result,
  });
}));

router.post('/traffic/stop', asyncHandler(async (_req: Request, res: Response) => {
  trafficSimulator.stopSimulation();
  res.json({
    message: 'Traffic simulator stopped',
    simulation: trafficSimulator.getResults(),
  });
}));

router.get('/traffic/results', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    simulation: trafficSimulator.getResults(),
  });
}));

router.post('/chaos/trigger', asyncHandler(async (req: Request, res: Response) => {
  const { host, port, faultType, delayMs, rate } = req.body;

  if (!host || !port || !faultType) {
    res.status(400).json({ error: true, message: 'Missing required fields: host, port, faultType' });
    return;
  }

  const postData = JSON.stringify({ delayMs, rate });
  const reqOptions = {
    hostname: host,
    port: Number(port),
    path: `/chaos${faultType}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
    timeout: 5000,
  };

  const chaosReq = http.request(reqOptions, (chaosRes) => {
    let body = '';
    chaosRes.on('data', (c) => (body += c));
    chaosRes.on('end', () => {
      try {
        res.status(chaosRes.statusCode || 200).json(JSON.parse(body));
      } catch {
        res.status(chaosRes.statusCode || 200).json({ message: body });
      }
    });
  });

  chaosReq.on('error', (err) => {
    res.status(502).json({ error: true, message: `Failed to trigger chaos on ${host}:${port}: ${err.message}` });
  });

  chaosReq.write(postData);
  chaosReq.end();
}));

export default router;
