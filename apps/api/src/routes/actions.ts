import express from 'express';
import { authenticate, AuthRequest } from '../auth';
import { MqttPublisher } from '@security-system/shared';
import mqtt from 'mqtt';

const router = express.Router();

// Create MQTT client for actions
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883');
const mqttPublisher = new MqttPublisher(mqttClient);

// Test actions endpoint
router.post('/test', authenticate, async (req: AuthRequest, res) => {
  try {
    const { type, data } = req.body;
    
    if (!type || !['siren', 'light', 'tts', 'push'].includes(type)) {
      return res.status(400).json({ error: 'Invalid action type.' });
    }

    const actionPayload = {
      type: type as 'siren' | 'light' | 'tts' | 'push',
      data: data || {}
    };

    // Publish action to MQTT
    mqttPublisher.publishAction(actionPayload);

    res.json({ 
      message: 'Action test triggered successfully.',
      action: actionPayload
    });
  } catch (error) {
    console.error('Test action error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Get system status
router.get('/status', authenticate, async (req: AuthRequest, res) => {
  try {
    // Check MQTT connection status
    const mqttStatus = mqttClient.connected ? 'connected' : 'disconnected';
    
    res.json({
      mqtt: mqttStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;