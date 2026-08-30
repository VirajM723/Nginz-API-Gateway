import { Router } from 'express';
import { processPayment } from '../controllers/paymentController';
import { asyncHandler } from '@nginz/middleware';

const router = Router();

router.post('/', asyncHandler(processPayment));

export default router;
