import { Database } from './database';
import { Detector } from './models/detector';
import { EmbeddingModel } from './models/embedding';
import { KNNClassifier } from './models/knn-classifier';
import { MQTTPublisher } from '@security-system/shared/mqtt';
import { 
  DetectionEvent, 
  Camera, 
  Zone, 
  Model, 
  CustomModel,
  EventSeverity 
} from '@security-system/shared/types';
import { EventType, DetectionType } from '@security-system/shared/types';

export class InferenceProcessor {
  private database: Database;
  private publisher: MQTTPublisher;
  private detector: Detector;
  private embeddingModel: EmbeddingModel;
  private knnClassifier: KNNClassifier;
  private models: Map<string, Model> = new Map();
  private customModels: Map<string, CustomModel> = new Map();
  private zones: Map<string, Zone[]> = new Map();

  constructor(
    database: Database,
    publisher: MQTTPublisher,
    detector: Detector,
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
    await this.loadModels();
    await this.loadZones();
    console.log('Inference processor initialized');
  }

  async processFrame(
    cameraId: string,
    frameData: Buffer,
    timestamp: Date
  ): Promise<void> {
    try {
      // Get camera configuration
      const camera = await this.getCamera(cameraId);
      if (!camera) {
        console.error(`Camera ${cameraId} not found`);
        return;
      }

      // Get zones for this camera
      const zones = this.zones.get(cameraId) || [];
      
      // Run object detection
      const detections = await this.detector.detect(frameData);
      
      // Process each detection
      for (const detection of detections) {
        // Check if detection is in any zone
        const inZones = this.checkZones(detection, zones);
        
        // Create base detection event
        const detectionEvent: Partial<DetectionEvent> = {
          cameraId,
          timestamp: timestamp.toISOString(),
          detectionType: detection.class as DetectionType,
          confidence: detection.confidence,
          bbox: detection.bbox,
          zones: inZones.map(z => z.name),
          metadata: {
            frameWidth: detection.frameWidth,
            frameHeight: detection.frameHeight
          }
        };

        // Run custom model classification if applicable
        if (detection.class === 'person' || detection.class === 'object') {
          const customResults = await this.runCustomClassification(
            frameData,
            detection.bbox,
            cameraId
          );
          
          if (customResults.length > 0) {
            detectionEvent.customDetections = customResults;
            // Use highest confidence custom detection as primary
            const bestCustom = customResults.reduce((best, current) => 
              current.confidence > best.confidence ? current : best
            );
            detectionEvent.detectionType = bestCustom.label as DetectionType;
            detectionEvent.confidence = bestCustom.confidence;
          }
        }

        // Determine severity based on detection type and confidence
        const severity = this.calculateSeverity(detectionEvent as DetectionEvent);
        detectionEvent.severity = severity;

        // Publish detection event
        await this.publisher.publishDetectionEvent(
          cameraId,
          detectionEvent as DetectionEvent
        );

        // Store detection in database
        await this.storeDetection(detectionEvent as DetectionEvent);
      }

      // Check for motion events (based on detection count and types)
      if (detections.length > 0) {
        const motionEvent = this.createMotionEvent(cameraId, detections, timestamp);
        if (motionEvent) {
          await this.publisher.publishMotionEvent(cameraId, motionEvent);
          await this.storeMotionEvent(motionEvent);
        }
      }

    } catch (error) {
      console.error(`Error processing frame for camera ${cameraId}:`, error);
    }
  }

  private async runCustomClassification(
    frameData: Buffer,
    bbox: { x: number; y: number; width: number; height: number },
    cameraId: string
  ): Promise<Array<{ label: string; confidence: number }>> {
    const results: Array<{ label: string; confidence: number }> = [];

    // Get active custom models for this camera
    const activeModels = Array.from(this.customModels.values()).filter(
      model => model.enabled && model.cameraIds.includes(cameraId)
    );

    for (const model of activeModels) {
      try {
        // Extract region of interest (ROI) from frame
        const roi = await this.extractROI(frameData, bbox);
        
        // Run KNN classification
        const classification = await this.knnClassifier.classify(roi, model.id);
        
        if (classification && classification.confidence >= model.confidenceThreshold) {
          results.push({
            label: classification.label,
            confidence: classification.confidence
          });
        }
      } catch (error) {
        console.error(`Error running custom model ${model.id}:`, error);
      }
    }

    return results;
  }

  private async extractROI(
    frameData: Buffer,
    bbox: { x: number; y: number; width: number; height: number }
  ): Promise<Buffer> {
    // For now, return the full frame - in production, crop to bbox
    // This would require image processing library like sharp or jimp
    // For prototyping, we'll use the full frame
    return frameData;
  }

  private checkZones(detection: any, zones: Zone[]): Zone[] {
    return zones.filter(zone => {
      if (!zone.polygon || zone.polygon.length === 0) return false;
      
      // Calculate detection center
      const centerX = detection.bbox.x + detection.bbox.width / 2;
      const centerY = detection.bbox.y + detection.bbox.height / 2;
      
      // Check if center point is inside polygon
      return this.pointInPolygon(centerX, centerY, zone.polygon);
    });
  }

  private pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  private calculateSeverity(event: DetectionEvent): EventSeverity {
    // Simple severity calculation based on detection type and confidence
    if (event.detectionType === 'person' && event.confidence > 0.8) {
      return 'high';
    } else if (event.confidence > 0.7) {
      return 'medium';
    } else {
      return 'low';
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
      eventType: EventType.MOTION,
      severity: significantDetections.length > 2 ? 'medium' : 'low',
      metadata: {
        detectionCount: detections.length,
        significantDetections: significantDetections.length,
        detectionTypes: [...new Set(detections.map(d => d.class))]
      }
    };
  }

  private async storeDetection(event: DetectionEvent): Promise<void> {
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

  private async getCamera(cameraId: string): Promise<Camera | null> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM cameras WHERE id = ?',
        [cameraId]
      );
      return rows.length > 0 ? rows[0] as Camera : null;
    } catch (error) {
      console.error('Error getting camera:', error);
      return null;
    }
  }

  private async loadModels(): Promise<void> {
    try {
      // Load standard models
      const modelRows = await this.database.query(
        'SELECT * FROM models WHERE enabled = 1'
      );
      
      modelRows.forEach(row => {
        this.models.set(row.id, row as Model);
      });

      // Load custom models
      const customModelRows = await this.database.query(
        'SELECT * FROM custom_models WHERE enabled = 1'
      );
      
      customModelRows.forEach(row => {
        this.customModels.set(row.id, row as CustomModel);
      });

      console.log(`Loaded ${this.models.size} standard models, ${this.customModels.size} custom models`);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  }

  private async loadZones(): Promise<void> {
    try {
      const rows = await this.database.query(
        'SELECT * FROM zones WHERE enabled = 1 ORDER BY camera_id'
      );
      
      rows.forEach(row => {
        const zone = row as Zone;
        if (!this.zones.has(zone.cameraId)) {
          this.zones.set(zone.cameraId, []);
        }
        this.zones.get(zone.cameraId)!.push(zone);
      });

      console.log(`Loaded zones for ${this.zones.size} cameras`);
    } catch (error) {
      console.error('Error loading zones:', error);
    }
  }

  async reloadModels(): Promise<void> {
    this.models.clear();
    this.customModels.clear();
    await this.loadModels();
  }

  async reloadZones(): Promise<void> {
    this.zones.clear();
    await this.loadZones();
  }
}