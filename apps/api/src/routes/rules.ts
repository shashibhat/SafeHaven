import express from 'express';
import { z } from 'zod';
import { getDatabase } from '../database';
import { authenticate, AuthRequest } from '../auth';
import { Rule } from '@security-system/shared';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const ruleSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional().default(true),
  conditions_json: z.string(), // JSON string of conditions
  actions_json: z.string(), // JSON string of actions
  cooldown_sec: z.number().int().min(0).optional().default(300),
  schedule_json: z.string().optional()
});

// Get all rules
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDatabase();
    const rules = await db.all<Rule[]>('SELECT * FROM rules ORDER BY created_at DESC');
    res.json(rules);
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get rule by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const rule = await db.get<Rule>(
      'SELECT * FROM rules WHERE id = ?',
      [id]
    );

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found.' });
    }

    res.json(rule);
  } catch (error) {
    console.error('Get rule error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create rule
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = ruleSchema.parse(req.body);
    const db = getDatabase();
    
    const ruleId = uuidv4();
    await db.run(
      `INSERT INTO rules (id, name, enabled, conditions_json, actions_json, cooldown_sec, schedule_json) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ruleId, data.name, data.enabled, data.conditions_json, data.actions_json, data.cooldown_sec, data.schedule_json]
    );

    const rule = await db.get<Rule>(
      'SELECT * FROM rules WHERE id = ?',
      [ruleId]
    );

    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input.', details: error.errors });
    }
    console.error('Create rule error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update rule
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = ruleSchema.partial().parse(req.body);
    const db = getDatabase();
    
    // Build dynamic update query
    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(updates), id];
    
    await db.run(
      `UPDATE rules SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    const rule = await db.get<Rule>(
      'SELECT * FROM rules WHERE id = ?',
      [id]
    );

    if (!rule) {
      return res.status(404).json({ error: 'Rule not found.' });
    }

    res.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input.', details: error.errors });
    }
    console.error('Update rule error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete rule
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    await db.run('DELETE FROM rules WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;