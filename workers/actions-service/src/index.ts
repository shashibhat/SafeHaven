import { Database } from './database';
import { ActionExecutor, ActionRequest } from './action-executor';
import { MQTTPublisher, MQTTSubscriber } from '@security-system/shared';
import * as path from 'path';

// Configuration
const CONFIG = {
  mqtt: {
    host: process.env.MQTT_HOST || 'localhost',
    port: parseInt(process.env.MQTT_PORT || '1883'),
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || ''
  },
  database: {
    path: process.env.DATABASE_PATH || path.join(__dirname, '../../data/security.db')
  },
  processing: {
    batchSize: parseInt(process.env.BATCH_SIZE || '10'),
    batchInterval: parseInt(process.env.BATCH_INTERVAL || '1000') // ms
  },
  hardware: {
    gpioEnabled: process.env.GPIO_ENABLED !== 'false',
    sirenPin: parseInt(process.env.SIREN_GPIO_PIN || '17'),
    lightPin: parseInt(process.env.LIGHT_GPIO_PIN || '18')
  }
};

class ActionsServiceWorker {
  private database: Database;
  private publisher: MQTTPublisher;
  private subscriber: MQTTSubscriber;
  private actionExecutor: ActionExecutor;
  private isRunning: boolean = false;
  private actionQueue: ActionRequest[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.database = new Database(CONFIG.database.path);
    this.publisher = new MQTTPublisher(CONFIG.mqtt);
    this.subscriber = new MQTTSubscriber(CONFIG.mqtt);
    this.actionExecutor = new ActionExecutor(this.database, this.publisher);
  }

  async start(): Promise<void> {
    try {
      console.log('Starting actions service worker...');
      
      // Initialize database
      await this.database.initialize();
      console.log('Database initialized');
      
      // Initialize action executor
      console.log('Action executor initialized');
      
      // Connect to MQTT
      await this.publisher.connect();
      await this.subscriber.connect();
      console.log('MQTT connected');
      
      // Subscribe to action requests
      await this.subscriber.subscribe('action/+', (topic, message) => {
        this.handleActionRequest(topic, message);
      });
      
      // Subscribe to recording control
      await this.subscriber.subscribe('recording/+/stop', (topic, message) => {
        this.handleRecordingStop(topic, message);
      });
      
      // Subscribe to configuration updates
      await this.subscriber.subscribe('config/actions/update', (topic, message) => {
        this.handleConfigUpdate(topic, message);
      });
      
      // Start processing loop
      this.startProcessingLoop();
      
      // Publish status
      await this.publisher.publishStatus('actions-service', 'online', {
        gpioEnabled: CONFIG.hardware.gpioEnabled,
        sirenPin: CONFIG.hardware.sirenPin,
        lightPin: CONFIG.hardware.lightPin,
        batchSize: CONFIG.processing.batchSize,
        batchInterval: CONFIG.processing.batchInterval
      });
      
      this.isRunning = true;
      console.log('Actions service worker started successfully');
      
    } catch (error) {
      console.error('Failed to start actions service worker:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping actions service worker...');
    
    this.isRunning = false;
    
    // Stop processing loop
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Publish offline status
    try {
      await this.publisher.publishStatus('actions-service', 'offline');
    } catch (error) {
      console.error('Error publishing offline status:', error);
    }
    
    // Disconnect MQTT
    await this.publisher.disconnect();
    await this.subscriber.disconnect();
    
    // Close database
    await this.database.close();
    
    console.log('Actions service worker stopped');
  }

  private handleActionRequest(topic: string, message: Buffer): void {
    try {
      // Parse topic: action/{actionType}
      const parts = topic.split('/');
      if (parts.length !== 2 || parts[0] !== 'action') {
        console.warn('Invalid action topic format:', topic);
        return;
      }
      
      const actionType = parts[1];
      const actionData = JSON.parse(message.toString());
      
      // Create action request
      const request: ActionRequest = {
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: actionType,
        cameraId: actionData.cameraId,
        eventId: actionData.eventId,
        parameters: actionData,
        timestamp: new Date()
      };
      
      // Add to queue
      this.actionQueue.push(request);
      
      console.log(`Action request queued: ${actionType} for camera ${actionData.cameraId}`);
      
    } catch (error) {
      console.error('Error handling action request:', error);
    }
  }

  private handleRecordingStop(topic: string, message: Buffer): void {
    try {
      // Parse topic: recording/{recordingId}/stop
      const parts = topic.split('/');
      if (parts.length !== 3 || parts[0] !== 'recording' || parts[2] !== 'stop') {
        console.warn('Invalid recording stop topic format:', topic);
        return;
      }
      
      const recordingId = parts[1];
      
      // Stop the recording
      const stopped = this.actionExecutor.stopRecording(recordingId);
      
      if (stopped) {
        console.log(`Recording stopped: ${recordingId}`);
        
        // Publish recording stopped event
        this.publisher.publishRecordingStopped(recordingId);
      } else {
        console.warn(`Recording not found or already stopped: ${recordingId}`);
      }
      
    } catch (error) {
      console.error('Error handling recording stop:', error);
    }
  }

  private handleConfigUpdate(topic: string, message: Buffer): void {
    try {
      const update = JSON.parse(message.toString());
      console.log('Configuration update received:', update);
      
      // Handle configuration updates for hardware settings
      if (update.gpioEnabled !== undefined) {
        CONFIG.hardware.gpioEnabled = update.gpioEnabled;
        console.log(`GPIO enabled: ${CONFIG.hardware.gpioEnabled}`);
      }
      
      if (update.sirenPin !== undefined) {
        CONFIG.hardware.sirenPin = update.sirenPin;
        console.log(`Siren pin updated: ${CONFIG.hardware.sirenPin}`);
      }
      
      if (update.lightPin !== undefined) {
        CONFIG.hardware.lightPin = update.lightPin;
        console.log(`Light pin updated: ${CONFIG.hardware.lightPin}`);
      }
      
    } catch (error) {
      console.error('Error handling config update:', error);
    }
  }

  private startProcessingLoop(): void {
    // Process actions in batches
    this.processingInterval = setInterval(async () => {
      if (!this.isRunning || this.actionQueue.length === 0) return;
      
      try {
        // Process actions in batches
        const batchSize = Math.min(CONFIG.processing.batchSize, this.actionQueue.length);
        const batch = this.actionQueue.splice(0, batchSize);
        
        console.log(`Processing ${batch.length} actions...`);
        
        // Execute actions in parallel
        const results = await Promise.allSettled(
          batch.map(request => this.actionExecutor.executeAction(request))
        );
        
        // Count successes and failures
        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').length;
        
        console.log(`Action batch completed: ${successes} successes, ${failures} failures`);
        
        // Log any failures
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Action failed: ${batch[index].type} for camera ${batch[index].cameraId}`, result.reason);
          }
        });
        
      } catch (error) {
        console.error('Error in processing loop:', error);
      }
    }, CONFIG.processing.batchInterval);
  }

  getStatus(): {
    running: boolean;
    queuedActions: number;
    activeRecordings: number;
    gpioEnabled: boolean;
  } {
    return {
      running: this.isRunning,
      queuedActions: this.actionQueue.length,
      activeRecordings: this.actionExecutor.getRecordingProcesses().length,
      gpioEnabled: CONFIG.hardware.gpioEnabled
    };
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  if (worker) {
    await worker.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  if (worker) {
    await worker.stop();
  }
  process.exit(0);
});

// Start the worker
const worker = new ActionsServiceWorker();

async function main() {
  try {
    await worker.start();
    
    // Health check endpoint (simple HTTP server)
    const http = require('http');
    const server = http.createServer((req: any, res: any) => {
      if (req.url === '/health') {
        const status = worker.getStatus();
        res.writeHead(status.running ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });
    
    const port = parseInt(process.env.HEALTH_PORT || '8084');
    server.listen(port, () => {
      console.log(`Health check endpoint listening on port ${port}`);
    });
    
  } catch (error) {
    console.error('Failed to start actions service worker:', error);
    process.exit(1);
  }
}

main();
