import express from 'express';
import { z } from 'zod';
import { getDatabase } from '../database';
import { authenticate, AuthRequest } from '../auth';
import { Event, Incident } from '@security-system/shared';

const router = express.Router();

const eventQuerySchema = z.object({
  cameraId: z.string().optional(),
  type: z.enum(['motion', 'person', 'package', 'face_match', 'door_open', 'loitering', 'tamper', 'custom_match', 'gesture_match']).optional(),
  severity: z.enum(['info', 'warn', 'critical']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0)
});

// Get events with filters
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const query = eventQuerySchema.parse(req.query);
    const db = getDatabase();
    
    let sql = `
      SELECT e.*, c.name as camera_name, z.name as zone_name
      FROM events e
      LEFT JOIN cameras c ON e.camera_id = c.id
      LEFT JOIN zones z ON e.zone_id = z.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (query.cameraId) {
      sql += ' AND e.camera_id = ?';
      params.push(query.cameraId);
    }
    
    if (query.type) {
      sql += ' AND e.event_type = ?';
      params.push(query.type);
    }
    
    if (query.severity) {
      sql += ' AND e.severity = ?';
      params.push(query.severity);
    }
    
    if (query.from) {
      sql += ' AND e.ts >= ?';
      params.push(query.from);
    }
    
    if (query.to) {
      sql += ' AND e.ts <= ?';
      params.push(query.to);
    }
    
    sql += ' ORDER BY e.ts DESC LIMIT ? OFFSET ?';
    params.push(query.limit, query.offset);
    
    const events = await db.all<Event[]>(sql, params);
    res.json(events);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters.', details: error.errors });
    }
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get event by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const event = await db.get<Event>(
      `SELECT e.*, c.name as camera_name, z.name as zone_name
       FROM events e
       LEFT JOIN cameras c ON e.camera_id = c.id
       LEFT JOIN zones z ON e.zone_id = z.id
       WHERE e.id = ?`,
      [id]
    );

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get event snapshot
router.get('/:id/snapshot', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const event = await db.get<Event>(
      'SELECT snapshot_path FROM events WHERE id = ?',
      [id]
    );

    if (!event || !event.snapshot_path) {
      return res.status(404).json({ error: 'Snapshot not found.' });
    }

    // Send snapshot file
    res.sendFile(event.snapshot_path, { root: '/' }, (err) => {
      if (err) {
        console.error('Send snapshot error:', err);
        res.status(404).json({ error: 'Snapshot file not found.' });
      }
    });
  } catch (error) {
    console.error('Get snapshot error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get event clip
router.get('/:id/clip', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const event = await db.get<Event>(
      'SELECT clip_path FROM events WHERE id = ?',
      [id]
    );

    if (!event || !event.clip_path) {
      return res.status(404).json({ error: 'Clip not found.' });
    }

    // Send clip file
    res.sendFile(event.clip_path, { root: '/' }, (err) => {
      if (err) {
        console.error('Send clip error:', err);
        res.status(404).json({ error: 'Clip file not found.' });
      }
    });
  } catch (error) {
    console.error('Get clip error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get incidents
router.get('/incidents', authenticate, async (req: AuthRequest, res) => {
  try {
    const { cameraId, status, limit = 50, offset = 0 } = req.query;
    const db = getDatabase();
    
    let sql = `
      SELECT i.*, c.name as camera_name
      FROM incidents i
      LEFT JOIN cameras c ON i.camera_id = c.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (cameraId) {
      sql += ' AND i.camera_id = ?';
      params.push(cameraId);
    }
    
    if (status) {
      sql += ' AND i.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY i.ts_start DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const incidents = await db.all<Incident[]>(sql, params);
    res.json(incidents);
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get incident by ID
router.get('/incidents/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const incident = await db.get<Incident>(
      `SELECT i.*, c.name as camera_name
       FROM incidents i
       LEFT JOIN cameras c ON i.camera_id = c.id
       WHERE i.id = ?`,
      [id]
    );

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found.' });
    }

    res.json(incident);
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Mark incident as resolved
router.patch('/incidents/:id/resolve', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    await db.run(
      'UPDATE incidents SET status = ?, ts_end = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['resolved', id]
    );

    const incident = await db.get<Incident>(
      'SELECT * FROM incidents WHERE id = ?',
      [id]
    );

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found.' });
    }

    res.json(incident);
  } catch (error) {
    console.error('Resolve incident error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;