import { Database } from './database';
import { ObjectDetector } from './models/detector';
import { EmbeddingModel } from './models/embedding';
import { KNNClassifier } from './models/knn-classifier';
import { MQTTPublisher } from '@security-system/shared';
import { Camera } from '@security-system/shared';

export class InferenceProcessor {
  private database: Database;
  private publisher: MQTTPublisher;
  private detector: ObjectDetector;
  private embeddingModel: EmbeddingModel;
  private knnClassifier: KNNClassifier;

  constructor(
    database: Database,
    publisher: MQTTPublisher,
    detector: ObjectDetector,
    embeddingModel: EmbeddingModel,
    knnClassifier: KNNClassifier
  ) {
    this.database = database;
    this.publisher = publisher;
    this.detector = detector;
    this.embeddingModel = embeddingModel;
    this.knnClassifier = knnClassifier;
  }

  async initialize(): Promise<void> {
    console.log('Inference processor initialized');
  }

  async processFrame(
    cameraId: string,
    frameData: Buffer,
    timestamp: Date
  ): Promise<void> {
    try {
      // Get camera configuration
      const camera: Camera | null = null;

      // Get zones for this camera
      const zones: any[] = [];
      
      // Run object detection
      const detections = await this.detector.detect(frameData);
      
      // Process each detection
      for (const detection of detections) {
        // Check if detection is in any zone
        const inZones: any[] = [];
        
        // Create base detection event
        const bbox = {
          x: detection.bbox[0],
          y: detection.bbox[1],
          width: detection.bbox[2],
          height: detection.bbox[3],
        };
        const detectionEvent: any = {
          cameraId,
          timestamp: timestamp.toISOString(),
          detectionType: detection.class,
          confidence: detection.confidence,
          bbox,
          zones: inZones.map((z: any) => z.name),
          metadata: {},
        };

        // Run custom model classification if applicable
        // Skip custom classification in local testing mode

        // Determine severity based on detection type and confidence
        const severity = this.calculateSeverity(detectionEvent);
        detectionEvent.severity = severity;

        // Publish detection event
        this.publisher.publishDetectionEvent(cameraId, detectionEvent);

        // Store detection in database
        // Optionally store to DB (skipped in local testing)
      }

      // Check for motion events (based on detection count and types)
      if (detections.length > 0) {
        const motionEvent = this.createMotionEvent(cameraId, detections, timestamp);
        if (motionEvent) {
          this.publisher.publishMotionEvent(cameraId, motionEvent);
        }
      }

    } catch (error) {
      console.error(`Error processing frame for camera ${cameraId}:`, error);
    }
  }

  // Custom classification is disabled in this local testing build

  private async extractROI(
    frameData: Buffer,
    bbox: { x: number; y: number; width: number; height: number }
  ): Promise<Buffer> {
    // For now, return the full frame - in production, crop to bbox
    // This would require image processing library like sharp or jimp
    // For prototyping, we'll use the full frame
    return frameData;
  }

  // Zone checks are disabled in this local testing build

  // Geometry helpers omitted

  private calculateSeverity(event: any): 'info' | 'warn' | 'critical' {
    // Simple severity calculation based on detection type and confidence
    if (event.detectionType === 'person' && event.confidence > 0.8) {
      return 'critical';
    } else if (event.confidence > 0.7) {
      return 'warn';
    } else {
      return 'info';
    }
  }

  private createMotionEvent(
    cameraId: string,
    detections: any[],
    timestamp: Date
  ): any {
    // Create motion event if there are significant detections
    const significantDetections = detections.filter(d => d.confidence > 0.5);
    
    if (significantDetections.length === 0) return null;

    return {
      cameraId,
      timestamp: timestamp.toISOString(),
      eventType: 'motion',
      severity: significantDetections.length > 2 ? 'medium' : 'low',
      metadata: {
        detectionCount: detections.length,
        significantDetections: significantDetections.length,
        detectionTypes: [...new Set(detections.map(d => d.class))]
      }
    };
  }

  private async storeDetection(event: any): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO detections 
         (camera_id, timestamp, detection_type, confidence, bbox_x, bbox_y, bbox_width, bbox_height, 
          zones, severity, custom_detections, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.cameraId,
          event.timestamp,
          event.detectionType,
          event.confidence,
          event.bbox.x,
          event.bbox.y,
          event.bbox.width,
          event.bbox.height,
          JSON.stringify(event.zones || []),
          event.severity,
          JSON.stringify(event.customDetections || []),
          JSON.stringify(event.metadata || {})
        ]
      );
    } catch (error) {
      console.error('Error storing detection:', error);
    }
  }

  private async storeMotionEvent(event: any): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO events 
         (camera_id, timestamp, event_type, severity, metadata, acknowledged)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          event.cameraId,
          event.timestamp,
          event.eventType,
          event.severity,
          JSON.stringify(event.metadata),
          false
        ]
      );
    } catch (error) {
      console.error('Error storing motion event:', error);
    }
  }

  // Camera lookup omitted

  // Model loading omitted

  // Zones loading omitted

  async reloadModels(): Promise<void> {
    // No-op
  }

  async reloadZones(): Promise<void> {
    // No-op
  }
}
