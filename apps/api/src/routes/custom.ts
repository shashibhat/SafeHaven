import express from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { getDatabase } from '../database';
import { authenticate, AuthRequest } from '../auth';
import { Model, ModelClass, TrainingSample, CustomModelConfig } from '@security-system/shared';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/avi'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'));
    }
  }
});

const modelSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['custom_object', 'custom_gesture', 'face_gallery']),
  labels: z.array(z.string().min(1)).min(1)
});

const actionPresetSchema = z.object({
  severity: z.enum(['info', 'warn', 'critical']),
  actions: z.array(z.object({
    type: z.enum(['siren', 'light', 'tts', 'push', 'record_clip', 'webhook']),
    data: z.record(z.any())
  })),
  scope: z.object({
    cameras: z.array(z.string()),
    zones: z.array(z.string()).optional(),
    schedule: z.string().optional()
  })
});

// Get all custom models
router.get('/models', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = getDatabase();
    const models = await db.all<Model[]>(
      'SELECT * FROM models WHERE type != "builtin" ORDER BY created_at DESC'
    );
    res.json(models);
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Create custom model
router.post('/models', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = modelSchema.parse(req.body);
    const db = getDatabase();
    
    const modelId = uuidv4();
    await db.run(
      'INSERT INTO models (id, name, type, status) VALUES (?, ?, ?, ?)',
      [modelId, data.name, data.type, 'building']
    );

    // Create model classes for each label
    for (const label of data.labels) {
      const classId = uuidv4();
      await db.run(
        'INSERT INTO model_classes (id, model_id, label, description) VALUES (?, ?, ?, ?)',
        [classId, modelId, label, `${label} detection class`]
      );
    }

    const model = await db.get<Model>(
      'SELECT * FROM models WHERE id = ?',
      [modelId]
    );

    res.status(201).json(model);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input.', details: error.errors });
    }
    console.error('Create model error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get model by ID
router.get('/models/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const model = await db.get<Model>(
      'SELECT * FROM models WHERE id = ?',
      [id]
    );

    if (!model) {
      return res.status(404).json({ error: 'Model not found.' });
    }

    const classes = await db.all<ModelClass[]>(
      'SELECT * FROM model_classes WHERE model_id = ?',
      [id]
    );

    const samples = await db.all<TrainingSample[]>(
      'SELECT * FROM training_samples WHERE model_id = ?',
      [id]
    );

    res.json({
      ...model,
      classes,
      sample_count: samples.length
    });
  } catch (error) {
    console.error('Get model error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Upload training samples
router.post('/models/:id/samples', authenticate, upload.array('files'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { class_label, action_preset } = req.body;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const db = getDatabase();
    
    // Verify model exists
    const model = await db.get<Model>(
      'SELECT * FROM models WHERE id = ?',
      [id]
    );

    if (!model) {
      return res.status(404).json({ error: 'Model not found.' });
    }

    // Parse action preset if provided
    let actionPresetData = null;
    if (action_preset) {
      actionPresetData = actionPresetSchema.parse(JSON.parse(action_preset));
    }

    // Process uploaded files
    const samples = [];
    for (const file of files) {
      const fileExt = path.extname(file.originalname);
      const newFilename = `${uuidv4()}${fileExt}`;
      const targetPath = path.join('data/training', newFilename);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      
      // Move file to permanent location
      await fs.rename(file.path, targetPath);
      
      const sampleId = uuidv4();
      const source = file.mimetype.startsWith('video/') ? 'video_extract' : 'upload';
      
      await db.run(
        'INSERT INTO training_samples (id, model_id, class_label, file_path, source) VALUES (?, ?, ?, ?, ?)',
        [sampleId, id, class_label, targetPath, source]
      );
      
      samples.push({ id: sampleId, file_path: targetPath });
    }

    // Update model class with action preset if provided
    if (actionPresetData) {
      await db.run(
        'UPDATE model_classes SET action_preset_json = ? WHERE model_id = ? AND label = ?',
        [JSON.stringify(actionPresetData), id, class_label]
      );
    }

    res.json({
      message: `Uploaded ${samples.length} samples successfully.`,
      samples
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input.', details: error.errors });
    }
    console.error('Upload samples error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Build model (start embedding generation)
router.post('/models/:id/build', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    // Update model status to building
    await db.run(
      'UPDATE models SET status = ?, meta_json = ? WHERE id = ?',
      ['building', JSON.stringify({ build_started: new Date().toISOString() }), id]
    );

    // TODO: Trigger actual embedding generation process
    // This would typically involve:
    // 1. Loading the samples
    // 2. Running them through a feature extraction model
    // 3. Storing the embeddings in the database
    // 4. Updating the model status to 'ready'

    // For now, simulate the process
    setTimeout(async () => {
      await db.run(
        'UPDATE models SET status = ?, meta_json = ? WHERE id = ?',
        ['ready', JSON.stringify({ build_completed: new Date().toISOString() }), id]
      );
    }, 5000);

    res.json({ message: 'Model build started.', status: 'building' });
  } catch (error) {
    console.error('Build model error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get model build status
router.get('/models/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const model = await db.get<Model>(
      'SELECT status, meta_json FROM models WHERE id = ?',
      [id]
    );

    if (!model) {
      return res.status(404).json({ error: 'Model not found.' });
    }

    const meta = model.meta_json ? JSON.parse(model.meta_json) : {};
    
    res.json({
      status: model.status,
      ...meta
    });
  } catch (error) {
    console.error('Get model status error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Test model on recent frames
router.post('/models/:id/test', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { camera_id, confidence_threshold = 0.7 } = req.body;
    const db = getDatabase();
    
    // Verify model exists and is ready
    const model = await db.get<Model>(
      'SELECT * FROM models WHERE id = ? AND status = "ready"',
      [id]
    );

    if (!model) {
      return res.status(404).json({ error: 'Model not found or not ready.' });
    }

    // TODO: Implement actual model testing
    // This would involve:
    // 1. Getting recent frames from the camera
    // 2. Running them through the model
    // 3. Returning detection results

    // For now, return mock results
    const mockResults = [
      {
        label: 'custom_object',
        confidence: 0.85,
        bbox: [100, 150, 200, 300],
        timestamp: new Date().toISOString()
      }
    ];

    res.json({
      results: mockResults,
      message: 'Model test completed.'
    });
  } catch (error) {
    console.error('Test model error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Deploy model (enable for inference)
router.post('/models/:id/deploy', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const db = getDatabase();
    
    // Update model deployment status
    const meta = { deployed: enabled, deployed_at: new Date().toISOString() };
    await db.run(
      'UPDATE models SET meta_json = ? WHERE id = ?',
      [JSON.stringify(meta), id]
    );

    res.json({
      message: `Model ${enabled ? 'deployed' : 'undeployed'} successfully.`,
      deployed: enabled
    });
  } catch (error) {
    console.error('Deploy model error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;