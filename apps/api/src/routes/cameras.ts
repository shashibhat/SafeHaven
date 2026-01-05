import express from 'express';
import { z } from 'zod';
import { getDatabase } from '../database';
import { authenticate, AuthRequest } from '../auth';
import { Camera, Zone } from '@security-system/shared';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

const cameraSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['rtsp', 'usb', 'onvif']),
  rtsp_url: z.string().url().optional(),
  location: z.string().min(1),
  enabled: z.boolean().optional().default(true),
  fps: z.number().int().min(1).max(30).optional().default(5),
  resolution: z.string().optional().default('640x480')
});

const zoneSchema = z.object({
  name: z.string().min(1),
  polygon_json: z.string(), // JSON string of polygon coordinates
  zone_type: z.enum(['doorway', 'driveway', 'porch', 'garage_opening', 'backyard', 'custom'])
});

// Get all cameras
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDatabase();
    const cameras = await db.all<Camera[]>('SELECT * FROM cameras ORDER BY created_at DESC');
    res.json(cameras);
  } catch (error) {
    console.error('Get cameras error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get camera by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const camera = await db.get<Camera>(
      'SELECT * FROM cameras WHERE id = ?',
      [id]
    );

    if (!camera) {
      return res.status(404).json({ error: 'Camera not found.' });
    }

    res.json(camera);
  } catch (error) {
    console.error('Get camera error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create camera
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = cameraSchema.parse(req.body);
    const db = getDatabase();
    
    const cameraId = uuidv4();
    await db.run(
      `INSERT INTO cameras (id, name, type, rtsp_url, location, enabled, fps, resolution) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cameraId, data.name, data.type, data.rtsp_url, data.location, data.enabled, data.fps, data.resolution]
    );

    const camera = await db.get<Camera>(
      'SELECT * FROM cameras WHERE id = ?',
      [cameraId]
    );

    res.status(201).json(camera);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input.', details: error.errors });
    }
    console.error('Create camera error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Update camera
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = cameraSchema.partial().parse(req.body);
    const db = getDatabase();
    
    // Build dynamic update query
    const setClause = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(updates), id];
    
    await db.run(
      `UPDATE cameras SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    const camera = await db.get<Camera>(
      'SELECT * FROM cameras WHERE id = ?',
      [id]
    );

    if (!camera) {
      return res.status(404).json({ error: 'Camera not found.' });
    }

    res.json(camera);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input.', details: error.errors });
    }
    console.error('Update camera error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Delete camera
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    await db.run('DELETE FROM cameras WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete camera error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Test camera connection
router.post('/:id/test', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const camera = await db.get<Camera>(
      'SELECT * FROM cameras WHERE id = ?',
      [id]
    );

    if (!camera) {
      return res.status(404).json({ error: 'Camera not found.' });
    }

    // Simple connection test - in real implementation, this would test RTSP connection
    const isConnected = camera.type === 'rtsp' ? 
      camera.rtsp_url?.includes('rtsp://') : 
      camera.enabled;

    res.json({
      connected: isConnected,
      camera: {
        id: camera.id,
        name: camera.name,
        type: camera.type,
        location: camera.location
      }
    });
  } catch (error) {
    console.error('Test camera error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get zones for camera
router.get('/:id/zones', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const zones = await db.all<Zone[]>(
      'SELECT * FROM zones WHERE camera_id = ? ORDER BY created_at DESC',
      [id]
    );
    
    res.json(zones);
  } catch (error) {
    console.error('Get zones error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create zone for camera
router.post('/:id/zones', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = zoneSchema.parse(req.body);
    const db = getDatabase();
    
    // Verify camera exists
    const camera = await db.get<Camera>(
      'SELECT * FROM cameras WHERE id = ?',
      [id]
    );

    if (!camera) {
      return res.status(404).json({ error: 'Camera not found.' });
    }

    const zoneId = uuidv4();
    await db.run(
      'INSERT INTO zones (id, camera_id, name, polygon_json, zone_type) VALUES (?, ?, ?, ?, ?)',
      [zoneId, id, data.name, data.polygon_json, data.zone_type]
    );

    const zone = await db.get<Zone>(
      'SELECT * FROM zones WHERE id = ?',
      [zoneId]
    );

    res.status(201).json(zone);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input.', details: error.errors });
    }
    console.error('Create zone error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;