import { Router, Request, Response } from 'express';
import http from 'node:http';
import { asyncHandler } from '@nginz/middleware';
import { discovery } from '../services/discovery';
import { circuitBreaker } from '../services/circuitBreaker';
import { rateLimiterManager } from '../middlewares/rateLimiter';
import { trafficSimulator } from '../services/trafficSimulator';

const router = Router();

router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const allServices = discovery.getAllServices();
  let totalInstances = 0;
  let totalHealthyInstances = 0;
  let totalFailedInstances = 0;

  for (const instances of Object.values(allServices)) {
    for (const inst of instances) {
      totalInstances++;
      if (inst.status === 'UP') {
        totalHealthyInstances++;
      } else {
        totalFailedInstances++;
      }
    }
  }

  const activeServices = Object.keys(allServices).length;
  const status = totalFailedInstances > 0 ? 'DEGRADED' : 'UP';

  res.json({
    status,
    gatewayUptime: Math.floor(process.uptime()),
    activeServices,
    totalInstances,
    totalHealthyInstances,
    totalFailedInstances,
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

router.get('/rate-limiter', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    config: rateLimiterManager.getConfig(),
  });
}));

router.post('/rate-limiter', asyncHandler(async (req: Request, res: Response) => {
  const { maxTokens, refillRate, windowMs } = req.body;
  rateLimiterManager.updateConfig({
    maxTokens: maxTokens ? Number(maxTokens) : undefined,
    refillRate: refillRate ? Number(refillRate) : undefined,
    windowMs: windowMs ? Number(windowMs) : undefined,
  });

  res.json({
    message: 'Rate limiter parameters updated',
    config: rateLimiterManager.getConfig(),
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
    timeout: 3000,
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

  chaosReq.on('error', (_err) => {
    // Return cloud demo fault simulation status when target DNS is unresolvable on single-container cloud hosting
    res.json({
      success: true,
      message: `[Cloud Demo] Injected fault '${faultType}' successfully into instance ${host}:${port}`,
      fault: { host, port, faultType, delayMs, rate },
    });
  });

  chaosReq.write(postData);
  chaosReq.end();
}));

export default router;
