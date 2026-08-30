import { Router } from 'express';
import { getUserById, createUser } from '../controllers/userController';
import { asyncHandler } from '@nginz/middleware';

const router = Router();

router.get('/:id', asyncHandler(getUserById));
router.post('/', asyncHandler(createUser));

export default router;
