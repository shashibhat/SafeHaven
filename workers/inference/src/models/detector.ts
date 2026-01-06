import { InferenceSession, Tensor } from 'onnxruntime-node';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export interface Detection {
  bbox: [number, number, number, number]; // [x, y, width, height]
  confidence: number;
  class: string;
  label: string;
}

export class ObjectDetector {
  private session: InferenceSession | null = null;
  private labels: string[] = [];
  private inputShape: [number, number, number, number] = [1, 3, 640, 640];
  private confidenceThreshold = 0.5;
  private nmsThreshold = 0.4;

  constructor(
    private modelPath: string,
    private labelsPath: string,
    options: {
      confidenceThreshold?: number;
      nmsThreshold?: number;
    } = {}
  ) {
    this.confidenceThreshold = options.confidenceThreshold || 0.5;
    this.nmsThreshold = options.nmsThreshold || 0.4;
  }

  async initialize(): Promise<void> {
    try {
      // Load model
      this.session = await InferenceSession.create(this.modelPath);
      
      // Load labels
      try {
        const labelsData = await fs.readFile(this.labelsPath, 'utf-8');
        this.labels = labelsData.split('\n').map(label => label.trim()).filter(label => label);
      } catch {
        this.labels = [];
      }
      
      // Use default input shape unless model introspection is available
      
      console.log(`Object detector initialized with ${this.labels.length} classes`);
    } catch (error) {
      console.error('Failed to initialize object detector:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return !!this.session;
  }

  async detect(imageBuffer: Buffer): Promise<Detection[]> {
    if (!this.session) {
      throw new Error('Detector not initialized');
    }

    try {
      // Preprocess image
      const inputTensor = await this.preprocessImage(imageBuffer);
      
      // Run inference
      const outputs = await this.session.run({ [this.session.inputNames[0]]: inputTensor });
      
      // Postprocess results
      const detections = this.postprocessOutputs(outputs);
      
      return detections;
    } catch (error) {
      console.error('Detection error:', error);
      return [];
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<Tensor> {
    // Resize and normalize image
    const [batch, channels, height, width] = this.inputShape;
    
    const image = sharp(imageBuffer)
      .resize(width, height, { fit: 'fill' })
      .removeAlpha()
      .raw();
    
    const { data, info } = await image.toBuffer({ resolveWithObject: true });
    
    // Convert to tensor format (NCHW)
    const float32Data = new Float32Array(channels * height * width);
    const uint8Data = new Uint8Array(data);
    
    // Normalize pixel values to [0, 1] and convert to CHW format
    for (let c = 0; c < channels; c++) {
      for (let h = 0; h < height; h++) {
        for (let w = 0; w < width; w++) {
          const srcIdx = (h * width + w) * channels + c;
          const dstIdx = c * height * width + h * width + w;
          float32Data[dstIdx] = uint8Data[srcIdx] / 255.0;
        }
      }
    }
    
    return new Tensor('float32', float32Data, this.inputShape);
  }

  private postprocessOutputs(outputs: Record<string, Tensor>): Detection[] {
    const outputName = this.session!.outputNames[0];
    const output = outputs[outputName];
    
    if (!output) {
      return [];
    }

    const detections: Detection[] = [];
    const data = output.data as Float32Array;
    
    // Parse output tensor (format depends on model)
    // Assuming YOLO-like output format: [x, y, w, h, confidence, class1, class2, ...]
    const numDetections = data.length / 6; // Adjust based on your model
    
    for (let i = 0; i < numDetections; i++) {
      const baseIdx = i * 6;
      const confidence = data[baseIdx + 4];
      
      if (confidence > this.confidenceThreshold) {
        const classId = Math.max(...data.slice(baseIdx + 5, baseIdx + 6));
        const label = this.labels[classId] || 'unknown';
        
        detections.push({
          bbox: [
            data[baseIdx],     // x
            data[baseIdx + 1], // y
            data[baseIdx + 2], // width
            data[baseIdx + 3]  // height
          ],
          confidence,
          class: classId.toString(),
          label
        });
      }
    }
    
    // Apply Non-Maximum Suppression
    return this.nonMaximumSuppression(detections);
  }

  private nonMaximumSuppression(detections: Detection[]): Detection[] {
    // Sort by confidence
    detections.sort((a, b) => b.confidence - a.confidence);
    
    const result: Detection[] = [];
    
    for (const detection of detections) {
      let shouldKeep = true;
      
      for (const kept of result) {
        if (this.calculateIoU(detection.bbox, kept.bbox) > this.nmsThreshold) {
          shouldKeep = false;
          break;
        }
      }
      
      if (shouldKeep) {
        result.push(detection);
      }
    }
    
    return result;
  }

  private calculateIoU(bbox1: [number, number, number, number], bbox2: [number, number, number, number]): number {
    const [x1, y1, w1, h1] = bbox1;
    const [x2, y2, w2, h2] = bbox2;
    
    const area1 = w1 * h1;
    const area2 = w2 * h2;
    
    const interX1 = Math.max(x1, x2);
    const interY1 = Math.max(y1, y2);
    const interX2 = Math.min(x1 + w1, x2 + w2);
    const interY2 = Math.min(y1 + h1, y2 + h2);
    
    if (interX2 <= interX1 || interY2 <= interY1) {
      return 0;
    }
    
    const interArea = (interX2 - interX1) * (interY2 - interY1);
    const unionArea = area1 + area2 - interArea;
    
    return interArea / unionArea;
  }

  async destroy(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
  }
}
