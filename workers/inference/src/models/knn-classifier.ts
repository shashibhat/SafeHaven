import { EmbeddingModel } from './embedding';
import { Database } from '../database';

export interface TrainingSample {
  embedding: number[];
  label: string;
  modelId: string;
}

export interface ClassificationResult {
  label: string;
  confidence: number;
  distance: number;
  neighbors: Neighbor[];
}

export interface Neighbor {
  label: string;
  distance: number;
  confidence: number;
}

export class KNNClassifier {
  private embeddingModel: EmbeddingModel;
  private database: Database;
  private k: number = 5; // Default k value
  private similarityThreshold: number = 0.7; // Minimum similarity for classification

  constructor(embeddingModel: EmbeddingModel, database: Database) {
    this.embeddingModel = embeddingModel;
    this.database = database;
  }

  async classify(
    imageData: Buffer | Uint8Array, 
    modelId: string,
    options: {
      k?: number;
      similarityThreshold?: number;
      useDistance?: boolean; // Use distance instead of similarity
    } = {}
  ): Promise<ClassificationResult | null> {
    const k = options.k || this.k;
    const threshold = options.similarityThreshold || this.similarityThreshold;
    const useDistance = options.useDistance || false;

    try {
      // Extract embedding from input image
      const queryEmbedding = await this.embeddingModel.extractEmbedding(imageData);
      
      // Get training samples from database
      const trainingSamples = await this.getTrainingSamples(modelId);
      
      if (trainingSamples.length === 0) {
        console.log(`No training samples found for model ${modelId}`);
        return null;
      }

      // Calculate distances/similarities to all training samples
      const distances = trainingSamples.map(sample => {
        const distance = useDistance 
          ? this.embeddingModel.euclideanDistance(queryEmbedding, sample.embedding)
          : 1 - this.embeddingModel.cosineSimilarity(queryEmbedding, sample.embedding);
        
        return {
          label: sample.label,
          distance,
          similarity: useDistance ? 1 / (1 + distance) : 1 - distance
        };
      });

      // Sort by distance (ascending)
      distances.sort((a, b) => a.distance - b.distance);
      
      // Get k nearest neighbors
      const neighbors = distances.slice(0, k);
      
      // Check if best match meets threshold
      const bestMatch = neighbors[0];
      if (bestMatch.similarity < threshold) {
        console.log(`Best match similarity ${bestMatch.similarity} below threshold ${threshold}`);
        return null;
      }

      // Count votes for each label
      const labelVotes = new Map<string, { count: number; totalSimilarity: number }>();
      
      neighbors.forEach(neighbor => {
        const current = labelVotes.get(neighbor.label) || { count: 0, totalSimilarity: 0 };
        labelVotes.set(neighbor.label, {
          count: current.count + 1,
          totalSimilarity: current.totalSimilarity + neighbor.similarity
        });
      });

      // Find label with most votes (weighted by similarity)
      let bestLabel = '';
      let bestScore = -1;
      let totalVotes = 0;

      labelVotes.forEach((data, label) => {
        // Weighted voting: count + average similarity
        const score = data.count * (data.totalSimilarity / data.count);
        if (score > bestScore) {
          bestScore = score;
          bestLabel = label;
          totalVotes = data.count;
        }
      });

      // Calculate confidence based on vote distribution and similarity
      const avgSimilarity = neighbors
        .filter(n => n.label === bestLabel)
        .reduce((sum, n) => sum + n.similarity, 0) / totalVotes;

      const confidence = Math.min(avgSimilarity * (totalVotes / k), 1.0);

      return {
        label: bestLabel,
        confidence,
        distance: bestMatch.distance,
        neighbors: neighbors.map(n => ({
          label: n.label,
          distance: n.distance,
          confidence: n.similarity
        }))
      };

    } catch (error) {
      console.error('Error in KNN classification:', error);
      throw error;
    }
  }

  async addTrainingSample(
    imageData: Buffer | Uint8Array,
    label: string,
    modelId: string
  ): Promise<void> {
    try {
      // Extract embedding
      const embedding = await this.embeddingModel.extractEmbedding(imageData);
      
      // Store in database
      await this.database.query(
        `INSERT INTO custom_model_samples (model_id, label, embedding, created_at) 
         VALUES (?, ?, ?, datetime('now'))`,
        [modelId, label, JSON.stringify(embedding)]
      );
      
      console.log(`Added training sample for model ${modelId}, label ${label}`);
    } catch (error) {
      console.error('Error adding training sample:', error);
      throw error;
    }
  }

  async removeTrainingSample(sampleId: number): Promise<void> {
    try {
      await this.database.query(
        'DELETE FROM custom_model_samples WHERE id = ?',
        [sampleId]
      );
      
      console.log(`Removed training sample ${sampleId}`);
    } catch (error) {
      console.error('Error removing training sample:', error);
      throw error;
    }
  }

  async getTrainingSamples(modelId: string): Promise<TrainingSample[]> {
    try {
      const rows = await this.database.query(
        'SELECT label, embedding FROM custom_model_samples WHERE model_id = ? ORDER BY created_at',
        [modelId]
      );

      return rows.map(row => ({
        embedding: JSON.parse(row.embedding as string),
        label: row.label as string,
        modelId
      }));
    } catch (error) {
      console.error('Error getting training samples:', error);
      throw error;
    }
  }

  async getTrainingStats(modelId: string): Promise<{
    totalSamples: number;
    labels: Record<string, number>;
    createdAt: Date;
  }> {
    try {
      const rows = await this.database.query(
        `SELECT label, COUNT(*) as count, MIN(created_at) as first_sample
         FROM custom_model_samples 
         WHERE model_id = ? 
         GROUP BY label`,
        [modelId]
      );

      const labels: Record<string, number> = {};
      let totalSamples = 0;
      let firstSampleDate = new Date();

      rows.forEach(row => {
        const count = row.count as number;
        const label = row.label as string;
        labels[label] = count;
        totalSamples += count;
        
        if (row.first_sample) {
          const sampleDate = new Date(row.first_sample as string);
          if (sampleDate < firstSampleDate) {
            firstSampleDate = sampleDate;
          }
        }
      });

      return {
        totalSamples,
        labels,
        createdAt: firstSampleDate
      };
    } catch (error) {
      console.error('Error getting training stats:', error);
      throw error;
    }
  }

  async clearTrainingData(modelId: string): Promise<void> {
    try {
      await this.database.query(
        'DELETE FROM custom_model_samples WHERE model_id = ?',
        [modelId]
      );
      
      console.log(`Cleared all training data for model ${modelId}`);
    } catch (error) {
      console.error('Error clearing training data:', error);
      throw error;
    }
  }

  setK(k: number): void {
    this.k = Math.max(1, k);
  }

  setSimilarityThreshold(threshold: number): void {
    this.similarityThreshold = Math.max(0, Math.min(1, threshold));
  }
}