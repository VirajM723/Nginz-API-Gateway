import { Request, Response, NextFunction, Router } from 'express';
import { createLogger } from '@nginz/logger';

const logger = createLogger('chaos-middleware');

interface ChaosState {
  failMode: boolean;
  slowDelayMs: number;
  randomErrorRate: number;
}

const chaosState: ChaosState = {
  failMode: false,
  slowDelayMs: 0,
  randomErrorRate: 0,
};

export const chaosMiddleware = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (chaosState.failMode) {
    logger.warn('[Chaos] Injecting HTTP 500 Internal Server Error');
    res.status(500).json({ error: true, message: 'Chaos Injected: Server Failure Mode Active' });
    return;
  }

  if (chaosState.randomErrorRate > 0 && Math.random() < chaosState.randomErrorRate) {
    logger.warn('[Chaos] Injecting Random Error');
    res.status(500).json({ error: true, message: 'Chaos Injected: Random Error Triggered' });
    return;
  }

  if (chaosState.slowDelayMs > 0) {
    logger.warn(`[Chaos] Injecting Latency: ${chaosState.slowDelayMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, chaosState.slowDelayMs));
  }

  next();
};

export const createChaosRouter = (): Router => {
  const router = Router();

  router.post('/fail', (_req: Request, res: Response) => {
    chaosState.failMode = true;
    res.json({ message: 'Chaos activated: Service in permanent fail mode', state: chaosState });
  });

  router.post('/slow', (req: Request, res: Response) => {
    const delay = Number(req.body.delayMs || 10000);
    chaosState.slowDelayMs = delay;
    res.json({ message: `Chaos activated: Injected ${delay}ms delay`, state: chaosState });
  });

  router.post('/random-error', (req: Request, res: Response) => {
    const rate = Number(req.body.rate || 0.3);
    chaosState.randomErrorRate = rate;
    res.json({ message: `Chaos activated: ${rate * 100}% random error rate`, state: chaosState });
  });

  router.post('/restore', (_req: Request, res: Response) => {
    chaosState.failMode = false;
    chaosState.slowDelayMs = 0;
    chaosState.randomErrorRate = 0;
    res.json({ message: 'Chaos restored: Service operating normally', state: chaosState });
  });

  router.get('/status', (_req: Request, res: Response) => {
    res.json({ state: chaosState });
  });

  return router;
};
