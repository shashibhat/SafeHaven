import express from 'express';
import { z } from 'zod';
import { getDatabase } from '../database';
import { authenticate, generateToken, comparePassword, hashPassword, AuthRequest } from '../auth';
import { User } from '@security-system/shared';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'user']).optional().default('user')
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const db = getDatabase();
    
    const user = await db.get<User>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!user || !await comparePassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input.', details: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Register endpoint (admin only)
router.post('/register', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { email, password, role } = registerSchema.parse(req.body);
    const db = getDatabase();
    
    // Check if user already exists
    const existingUser = await db.get<User>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists.' });
    }

    const hashedPassword = await hashPassword(password);
    const userId = uuidv4();
    
    await db.run(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [userId, email, hashedPassword, role]
    );

    const newUser = await db.get<User>(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    res.status(201).json({
      user: {
        id: newUser!.id,
        email: newUser!.email,
        role: newUser!.role,
        created_at: newUser!.created_at
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input.', details: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Logout endpoint (client-side token removal)
router.post('/logout', authenticate, (req: AuthRequest, res) => {
  // In a stateless JWT system, logout is handled client-side
  // This endpoint is provided for consistency and potential future enhancements
  res.json({ message: 'Logged out successfully.' });
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      created_at: req.user!.created_at
    }
  });
});

export default router;