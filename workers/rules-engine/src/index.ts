import { Database } from './database';
import { RuleEngine } from './rule-engine';
import { MQTTPublisher, MQTTSubscriber } from '@security-system/shared/mqtt';
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
  }
};

class RulesEngineWorker {
  private database: Database;
  private publisher: MQTTPublisher;
  private subscriber: MQTTSubscriber;
  private ruleEngine: RuleEngine;
  private isRunning: boolean = false;
  private eventQueue: any[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.database = new Database(CONFIG.database.path);
    this.publisher = new MQTTPublisher(CONFIG.mqtt);
    this.subscriber = new MQTTSubscriber(CONFIG.mqtt);
    this.ruleEngine = new RuleEngine(this.database, this.publisher);
  }

  async start(): Promise<void> {
    try {
      console.log('Starting rules engine worker...');
      
      // Initialize database
      await this.database.initialize();
      console.log('Database initialized');
      
      // Initialize rule engine
      await this.ruleEngine.initialize();
      console.log('Rule engine initialized');
      
      // Connect to MQTT
      await this.publisher.connect();
      await this.subscriber.connect();
      console.log('MQTT connected');
      
      // Subscribe to detection events
      await this.subscriber.subscribe('detection/+', (topic, message) => {
        this.handleDetectionEvent(topic, message);
      });
      
      // Subscribe to motion events
      await this.subscriber.subscribe('motion/+', (topic, message) => {
        this.handleMotionEvent(topic, message);
      });
      
      // Subscribe to configuration updates
      await this.subscriber.subscribe('config/rules/update', (topic, message) => {
        this.handleConfigUpdate(topic, message);
      });
      
      // Start processing loop
      this.startProcessingLoop();
      
      // Publish status
      await this.publisher.publishStatus('rules-engine', 'online', {
        batchSize: CONFIG.processing.batchSize,
        batchInterval: CONFIG.processing.batchInterval
      });
      
      this.isRunning = true;
      console.log('Rules engine worker started successfully');
      
    } catch (error) {
      console.error('Failed to start rules engine worker:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping rules engine worker...');
    
    this.isRunning = false;
    
    // Stop processing loop
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Publish offline status
    try {
      await this.publisher.publishStatus('rules-engine', 'offline');
    } catch (error) {
      console.error('Error publishing offline status:', error);
    }
    
    // Disconnect MQTT
    await this.publisher.disconnect();
    await this.subscriber.disconnect();
    
    // Close database
    await this.database.close();
    
    console.log('Rules engine worker stopped');
  }

  private handleDetectionEvent(topic: string, message: Buffer): void {
    try {
      // Parse topic: detection/{cameraId}
      const parts = topic.split('/');
      if (parts.length !== 2 || parts[0] !== 'detection') {
        console.warn('Invalid detection topic format:', topic);
        return;
      }
      
      const cameraId = parts[1];
      const event = JSON.parse(message.toString());
      
      // Add to queue
      this.eventQueue.push({
        type: 'detection',
        cameraId,
        event,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error handling detection event:', error);
    }
  }

  private handleMotionEvent(topic: string, message: Buffer): void {
    try {
      // Parse topic: motion/{cameraId}
      const parts = topic.split('/');
      if (parts.length !== 2 || parts[0] !== 'motion') {
        console.warn('Invalid motion topic format:', topic);
        return;
      }
      
      const cameraId = parts[1];
      const event = JSON.parse(message.toString());
      
      // Convert motion event to detection-like format for rule processing
      const detectionEvent = {
        id: event.id || `motion-${Date.now()}`,
        cameraId,
        timestamp: event.timestamp,
        detectionType: 'motion',
        confidence: 0.8, // Default confidence for motion
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        zones: [],
        severity: event.severity || 'medium',
        metadata: event.metadata || {}
      };
      
      // Add to queue
      this.eventQueue.push({
        type: 'motion',
        cameraId,
        event: detectionEvent,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error handling motion event:', error);
    }
  }

  private handleConfigUpdate(topic: string, message: Buffer): void {
    try {
      const update = JSON.parse(message.toString());
      console.log('Configuration update received:', update);
      
      if (update.type === 'rules') {
        this.ruleEngine.reloadRules();
      }
      
    } catch (error) {
      console.error('Error handling config update:', error);
    }
  }

  private startProcessingLoop(): void {
    // Process events in batches
    this.processingInterval = setInterval(async () => {
      if (!this.isRunning || this.eventQueue.length === 0) return;
      
      try {
        // Process events in batches
        const batchSize = Math.min(CONFIG.processing.batchSize, this.eventQueue.length);
        const batch = this.eventQueue.splice(0, batchSize);
        
        for (const item of batch) {
          await this.ruleEngine.processEvent(item.event);
        }
        
        console.log(`Processed ${batch.length} events`);
        
      } catch (error) {
        console.error('Error in processing loop:', error);
      }
    }, CONFIG.processing.batchInterval);
  }

  getStatus(): {
    running: boolean;
    queuedEvents: number;
    ruleStats: ReturnType<RuleEngine['getRuleStats']>;
  } {
    return {
      running: this.isRunning,
      queuedEvents: this.eventQueue.length,
      ruleStats: this.ruleEngine.getRuleStats()
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
const worker = new RulesEngineWorker();

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
    
    const port = parseInt(process.env.HEALTH_PORT || '8083');
    server.listen(port, () => {
      console.log(`Health check endpoint listening on port ${port}`);
    });
    
  } catch (error) {
    console.error('Failed to start rules engine worker:', error);
    process.exit(1);
  }
}

main();