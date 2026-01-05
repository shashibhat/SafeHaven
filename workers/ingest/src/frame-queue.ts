import { CameraFrame } from './camera-manager';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class FrameQueue {
  private queue: CameraFrame[] = [];
  private maxSize = 100;
  private snapshotPath: string;

  constructor(snapshotPath: string = './data/snapshots') {
    this.snapshotPath = snapshotPath;
    this.ensureDirectory();
  }

  private async ensureDirectory(): Promise<void> {
    await fs.mkdir(this.snapshotPath, { recursive: true });
  }

  push(frame: CameraFrame): void {
    // Add frame to queue
    this.queue.push(frame);

    // Save frame to disk for inference worker
    this.saveFrame(frame);

    // Maintain queue size limit
    if (this.queue.length > this.maxSize) {
      this.queue.shift();
    }
  }

  private async saveFrame(frame: CameraFrame): Promise<void> {
    try {
      const filename = `${frame.cameraId}_${frame.id}.jpg`;
      const filepath = path.join(this.snapshotPath, filename);
      
      await fs.writeFile(filepath, frame.data);
      
      // Clean up old frames after 1 hour
      setTimeout(async () => {
        try {
          await fs.unlink(filepath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 3600000);
      
    } catch (error) {
      console.error(`Failed to save frame ${frame.id}:`, error);
    }
  }

  getLatestFrame(cameraId: string): CameraFrame | null {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].cameraId === cameraId) {
        return this.queue[i];
      }
    }
    return null;
  }

  getFrames(cameraId: string, limit: number = 10): CameraFrame[] {
    const frames: CameraFrame[] = [];
    for (let i = this.queue.length - 1; i >= 0 && frames.length < limit; i--) {
      if (this.queue[i].cameraId === cameraId) {
        frames.push(this.queue[i]);
      }
    }
    return frames;
  }

  getSize(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.snapshotPath);
      const now = Date.now();
      const maxAge = 3600000; // 1 hour

      for (const file of files) {
        const filepath = path.join(this.snapshotPath, file);
        const stats = await fs.stat(filepath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filepath);
        }
      }
    } catch (error) {
      console.error('Frame cleanup error:', error);
    }
  }
}