import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { asyncHandler } from '@nginz/middleware';

const router = Router();
const authController = new AuthController();

router.post('/login', asyncHandler(authController.login.bind(authController)));
router.get('/validate', asyncHandler(authController.validate.bind(authController)));
router.post('/register', asyncHandler(authController.register.bind(authController)));

export default router;
