import mqtt from 'mqtt';
import { getDatabase } from './database';
import { CameraManager } from './camera-manager';
import { FrameQueue } from './frame-queue';
import { MqttPublisher, HealthStatus } from '@security-system/shared';
import { Camera } from '@security-system/shared';

class CameraIngestWorker {
  private mqttClient: mqtt.MqttClient;
  private mqttPublisher: MqttPublisher;
  private cameraManager: CameraManager;
  private frameQueue: FrameQueue;
  private isRunning = false;
  private pollInterval = 30000; // 30 seconds
  private healthCheckInterval = 60000; // 60 seconds

  constructor() {
    this.mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883');
    this.mqttPublisher = new MqttPublisher(this.mqttClient);
    this.frameQueue = new FrameQueue();
    this.cameraManager = new CameraManager(this.mqttClient, this.frameQueue);
  }

  async start(): Promise<void> {
    console.log('Starting Camera Ingest Worker...');
    
    this.isRunning = true;
    
    // Wait for MQTT connection
    await this.waitForMqttConnection();
    
    // Start initial camera discovery
    await this.discoverCameras();
    
    // Start polling for camera changes
    this.startPolling();
    
    // Start health check reporting
    this.startHealthCheck();
    
    console.log('Camera Ingest Worker started successfully');
  }

  async stop(): Promise<void> {
    console.log('Stopping Camera Ingest Worker...');
    
    this.isRunning = false;
    
    // Stop all camera streams
    const cameras = this.cameraManager.getAllCameraStatuses();
    for (const cameraStatus of cameras) {
      await this.cameraManager.stopCamera(cameraStatus.cameraId);
    }
    
    // Cleanup
    await this.frameQueue.cleanup();
    
    // Disconnect MQTT
    this.mqttClient.end();
    
    console.log('Camera Ingest Worker stopped');
  }

  private async waitForMqttConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MQTT connection timeout'));
      }, 10000);

      this.mqttClient.on('connect', () => {
        clearTimeout(timeout);
        console.log('Connected to MQTT broker');
        resolve();
      });

      this.mqttClient.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async discoverCameras(): Promise<void> {
    try {
      console.log('Discovering cameras...');
      const db = getDatabase();
      
      const cameras = await db.all<Camera[]>(
        'SELECT * FROM cameras WHERE enabled = 1 ORDER BY created_at DESC'
      );
      
      console.log(`Found ${cameras.length} enabled cameras`);
      
      await this.cameraManager.updateCameras(cameras);
      
    } catch (error) {
      console.error('Camera discovery error:', error);
    }
  }

  private startPolling(): void {
    const poll = async () => {
      if (!this.isRunning) return;
      
      try {
        await this.discoverCameras();
      } catch (error) {
        console.error('Polling error:', error);
      }
      
      setTimeout(poll, this.pollInterval);
    };
    
    poll();
  }

  private startHealthCheck(): void {
    const reportHealth = async () => {
      if (!this.isRunning) return;
      
      try {
        const healthStatus: HealthStatus = {
          service: 'camera-ingest',
          status: 'healthy',
          timestamp: new Date(),
          details: {
            activeCameras: this.cameraManager.getAllCameraStatuses().length,
            frameQueueSize: this.frameQueue.getSize()
          }
        };
        
        this.mqttPublisher.publishHealth('camera-ingest', healthStatus);
        
      } catch (error) {
        console.error('Health check error:', error);
      }
      
      setTimeout(reportHealth, this.healthCheckInterval);
    };
    
    reportHealth();
  }
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await worker.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await worker.stop();
  process.exit(0);
});

// Start the worker
const worker = new CameraIngestWorker();

worker.start().catch((error) => {
  console.error('Failed to start Camera Ingest Worker:', error);
  process.exit(1);
});