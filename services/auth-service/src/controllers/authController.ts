import { Request, Response } from 'express';
import { AuthService } from '../services/authService';

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: true, message: 'Email and password are required' });
      return;
    }

    const result = await authService.login(email, password);
    res.json(result);
  }

  async validate(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: true, message: 'Authorization header missing or invalid' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = await authService.validateToken(token);
    res.json({ valid: true, payload: decoded });
  }

  async register(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: true, message: 'Email and password are required' });
      return;
    }

    const user = await authService.register(email, password);
    res.status(201).json(user);
  }
}
