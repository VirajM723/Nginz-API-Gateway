import { Router } from 'express';
import { getProducts, getProductById, createProduct } from '../controllers/productController';
import { asyncHandler } from '@nginz/middleware';

const router = Router();

router.get('/', asyncHandler(getProducts));
router.get('/:id', asyncHandler(getProductById));
router.post('/', asyncHandler(createProduct));

export default router;
