import { Database } from './database';
import { MQTTPublisher, MQTTSubscriber } from '@security-system/shared/mqtt';
import { Detector } from './models/detector';
import { EmbeddingModel } from './models/embedding';
import { KNNClassifier } from './models/knn-classifier';
import { InferenceProcessor } from './processor';
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
  models: {
    detector: process.env.DETECTOR_MODEL_PATH || path.join(__dirname, '../models/yolov8n.onnx'),
    embedding: process.env.EMBEDDING_MODEL_PATH || path.join(__dirname, '../models/mobilenetv2.onnx')
  },
  inference: {
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.5'),
    nmsThreshold: parseFloat(process.env.NMS_THRESHOLD || '0.4'),
    inputSize: parseInt(process.env.INPUT_SIZE || '640')
  }
};

class InferenceWorker {
  private database: Database;
  private publisher: MQTTPublisher;
  private subscriber: MQTTSubscriber;
  private detector: Detector;
  private embeddingModel: EmbeddingModel;
  private knnClassifier: KNNClassifier;
  private processor: InferenceProcessor;
  private isRunning: boolean = false;
  private frameQueue: Map<string, Array<{ frame: Buffer; timestamp: Date }>> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.database = new Database(CONFIG.database.path);
    this.publisher = new MQTTPublisher(CONFIG.mqtt);
    this.subscriber = new MQTTSubscriber(CONFIG.mqtt);
    this.detector = new Detector(
      CONFIG.models.detector,
      CONFIG.inference.confidenceThreshold,
      CONFIG.inference.nmsThreshold,
      CONFIG.inference.inputSize
    );
    this.embeddingModel = new EmbeddingModel(CONFIG.models.embedding);
    this.knnClassifier = new KNNClassifier(this.embeddingModel, this.database);
    this.processor = new InferenceProcessor(
      this.database,
      this.publisher,
      this.detector,
      this.embeddingModel,
      this.knnClassifier
    );
  }

  async start(): Promise<void> {
    try {
      console.log('Starting inference worker...');
      
      // Initialize database
      await this.database.initialize();
      console.log('Database initialized');
      
      // Initialize models
      await this.detector.initialize();
      console.log('Object detector initialized');
      
      await this.embeddingModel.initialize();
      console.log('Embedding model initialized');
      
      // Initialize processor
      await this.processor.initialize();
      console.log('Inference processor initialized');
      
      // Connect to MQTT
      await this.publisher.connect();
      await this.subscriber.connect();
      console.log('MQTT connected');
      
      // Subscribe to frame topics
      await this.subscriber.subscribe('camera/+/frame', (topic, message) => {
        this.handleFrameMessage(topic, message);
      });
      
      // Subscribe to configuration updates
      await this.subscriber.subscribe('config/+/update', (topic, message) => {
        this.handleConfigUpdate(topic, message);
      });
      
      // Start processing loop
      this.startProcessingLoop();
      
      // Publish status
      await this.publisher.publishStatus('inference-worker', 'online', {
        models: {
          detector: CONFIG.models.detector,
          embedding: CONFIG.models.embedding
        },
        confidenceThreshold: CONFIG.inference.confidenceThreshold,
        nmsThreshold: CONFIG.inference.nmsThreshold
      });
      
      this.isRunning = true;
      console.log('Inference worker started successfully');
      
    } catch (error) {
      console.error('Failed to start inference worker:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping inference worker...');
    
    this.isRunning = false;
    
    // Stop processing loop
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Publish offline status
    try {
      await this.publisher.publishStatus('inference-worker', 'offline');
    } catch (error) {
      console.error('Error publishing offline status:', error);
    }
    
    // Disconnect MQTT
    await this.publisher.disconnect();
    await this.subscriber.disconnect();
    
    // Close database
    await this.database.close();
    
    console.log('Inference worker stopped');
  }

  private handleFrameMessage(topic: string, message: Buffer): void {
    try {
      // Parse topic: camera/{cameraId}/frame
      const parts = topic.split('/');
      if (parts.length !== 3 || parts[0] !== 'camera' || parts[2] !== 'frame') {
        console.warn('Invalid frame topic format:', topic);
        return;
      }
      
      const cameraId = parts[1];
      
      // Parse message (JSON with frame data and timestamp)
      const frameData = JSON.parse(message.toString());
      const frame = Buffer.from(frameData.frame, 'base64');
      const timestamp = new Date(frameData.timestamp);
      
      // Add to queue
      if (!this.frameQueue.has(cameraId)) {
        this.frameQueue.set(cameraId, []);
      }
      
      const queue = this.frameQueue.get(cameraId)!;
      queue.push({ frame, timestamp });
      
      // Keep only last 5 frames per camera to prevent memory issues
      if (queue.length > 5) {
        queue.shift();
      }
      
    } catch (error) {
      console.error('Error handling frame message:', error);
    }
  }

  private handleConfigUpdate(topic: string, message: Buffer): void {
    try {
      const update = JSON.parse(message.toString());
      console.log('Configuration update received:', update);
      
      if (update.type === 'models') {
        this.processor.reloadModels();
      } else if (update.type === 'zones') {
        this.processor.reloadZones();
      }
      
    } catch (error) {
      console.error('Error handling config update:', error);
    }
  }

  private startProcessingLoop(): void {
    // Process frames every 100ms (10 FPS processing rate)
    this.processingInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.processQueuedFrames();
      } catch (error) {
        console.error('Error in processing loop:', error);
      }
    }, 100);
  }

  private async processQueuedFrames(): Promise<void> {
    for (const [cameraId, queue] of this.frameQueue.entries()) {
      if (queue.length === 0) continue;
      
      // Process the most recent frame
      const { frame, timestamp } = queue[queue.length - 1];
      
      try {
        await this.processor.processFrame(cameraId, frame, timestamp);
      } catch (error) {
        console.error(`Error processing frame for camera ${cameraId}:`, error);
      }
      
      // Clear processed frames
      queue.length = 0;
    }
  }

  getStatus(): {
    running: boolean;
    queuedFrames: number;
    modelsLoaded: boolean;
  } {
    const totalQueued = Array.from(this.frameQueue.values())
      .reduce((total, queue) => total + queue.length, 0);
    
    return {
      running: this.isRunning,
      queuedFrames: totalQueued,
      modelsLoaded: this.detector.isInitialized() && this.embeddingModel.isInitialized()
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
const worker = new InferenceWorker();

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
    
    const port = parseInt(process.env.HEALTH_PORT || '8082');
    server.listen(port, () => {
      console.log(`Health check endpoint listening on port ${port}`);
    });
    
  } catch (error) {
    console.error('Failed to start inference worker:', error);
    process.exit(1);
  }
}

main();