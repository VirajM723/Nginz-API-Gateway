import { Router } from 'express';
import { createOrder, getOrderById } from '../controllers/orderController';
import { asyncHandler } from '@nginz/middleware';

const router = Router();

router.post('/', asyncHandler(createOrder));
router.get('/:id', asyncHandler(getOrderById));

export default router;
