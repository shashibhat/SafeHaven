import { InferenceSession, Tensor } from 'onnxruntime-node';
import * as path from 'path';
import sharp from 'sharp';

export interface EmbeddingResult {
  embedding: number[];
  label?: string;
  confidence?: number;
}

export class EmbeddingModel {
  private session: InferenceSession | null = null;
  private modelPath: string;

  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }

  async initialize(): Promise<void> {
    try {
      this.session = await InferenceSession.create(this.modelPath);
      console.log('Embedding model loaded successfully');
    } catch (error) {
      console.error('Failed to load embedding model:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return !!this.session;
  }

  async extractEmbedding(imageData: Buffer | Uint8Array): Promise<number[]> {
    if (!this.session) {
      throw new Error('Embedding model not initialized');
    }

    try {
      // Preprocess image for embedding model (typically 224x224 for MobileNet)
      const tensor = await this.preprocessImage(imageData, 224, 224);
      
      // Run inference
      const feeds = { input: tensor };
      const results = await this.session.run(feeds);
      
      // Extract embedding from output tensor
      const output = results.output || results.embeddings || results['output'];
      if (!output) {
        throw new Error('No embedding output found in model results');
      }

      const embedding = Array.from(output.data as Float32Array);
      
      // Normalize embedding
      return this.normalizeEmbedding(embedding);
    } catch (error) {
      console.error('Error extracting embedding:', error);
      throw error;
    }
  }

  private async preprocessImage(
    imageData: Buffer | Uint8Array,
    width: number,
    height: number
  ): Promise<Tensor> {
    const inputBuffer = imageData instanceof Buffer ? imageData : Buffer.from(imageData);
    const { data, info } = await sharp(inputBuffer)
      .resize(width, height, { fit: 'fill' })
      .toColourspace('rgb')
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgbData = new Float32Array(3 * width * height);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let i = 0; i < width * height; i++) {
      const r = data[i * 3] / 255.0;
      const g = data[i * 3 + 1] / 255.0;
      const b = data[i * 3 + 2] / 255.0;

      rgbData[i] = (r - mean[0]) / std[0];
      rgbData[i + width * height] = (g - mean[1]) / std[1];
      rgbData[i + 2 * width * height] = (b - mean[2]) / std[2];
    }

    return new Tensor('float32', rgbData, [1, 3, height, width]);
  }

  private normalizeEmbedding(embedding: number[]): number[] {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (norm || 1));
  }

  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimension');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2) || 1);
  }

  euclideanDistance(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have same dimension');
    }
    
    let distance = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      distance += diff * diff;
    }
    
    return Math.sqrt(distance);
  }
}
