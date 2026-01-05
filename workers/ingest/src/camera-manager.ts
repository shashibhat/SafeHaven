import { spawn, ChildProcess } from 'child_process';
import { Camera, CameraHealth } from '@security-system/shared';
import { MqttPublisher } from '@security-system/shared';
import mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export class CameraManager {
  private cameras: Map<string, CameraStream> = new Map();
  private mqttPublisher: MqttPublisher;
  private frameQueue: FrameQueue;

  constructor(mqttClient: mqtt.MqttClient, frameQueue: FrameQueue) {
    this.mqttPublisher = new MqttPublisher(mqttClient);
    this.frameQueue = frameQueue;
  }

  async startCamera(camera: Camera): Promise<void> {
    if (this.cameras.has(camera.id)) {
      console.log(`Camera ${camera.id} is already running`);
      return;
    }

    const stream = new CameraStream(camera, this.mqttPublisher, this.frameQueue);
    this.cameras.set(camera.id, stream);
    
    try {
      await stream.start();
      console.log(`Started camera stream: ${camera.name} (${camera.id})`);
    } catch (error) {
      console.error(`Failed to start camera ${camera.id}:`, error);
      this.cameras.delete(camera.id);
      throw error;
    }
  }

  async stopCamera(cameraId: string): Promise<void> {
    const stream = this.cameras.get(cameraId);
    if (!stream) {
      console.log(`Camera ${cameraId} not found`);
      return;
    }

    try {
      await stream.stop();
      this.cameras.delete(cameraId);
      console.log(`Stopped camera stream: ${cameraId}`);
    } catch (error) {
      console.error(`Failed to stop camera ${cameraId}:`, error);
      throw error;
    }
  }

  async restartCamera(camera: Camera): Promise<void> {
    await this.stopCamera(camera.id);
    await this.startCamera(camera);
  }

  getCameraStatus(cameraId: string): CameraHealth | null {
    const stream = this.cameras.get(cameraId);
    if (!stream) {
      return null;
    }
    return stream.getHealthStatus();
  }

  getAllCameraStatuses(): CameraHealth[] {
    return Array.from(this.cameras.values()).map(stream => stream.getHealthStatus());
  }

  async updateCameras(cameras: Camera[]): Promise<void> {
    const currentIds = new Set(this.cameras.keys());
    const newIds = new Set(cameras.map(c => c.id));

    // Stop cameras that are no longer in the list
    for (const cameraId of currentIds) {
      if (!newIds.has(cameraId)) {
        await this.stopCamera(cameraId);
      }
    }

    // Start new cameras
    for (const camera of cameras) {
      if (!currentIds.has(camera.id) && camera.enabled) {
        try {
          await this.startCamera(camera);
        } catch (error) {
          console.error(`Failed to start camera ${camera.id}:`, error);
        }
      }
    }
  }
}

class CameraStream {
  private camera: Camera;
  private ffmpeg: ChildProcess | null = null;
  private mqttPublisher: MqttPublisher;
  private frameQueue: FrameQueue;
  private healthStatus: CameraHealth;
  private frameCount = 0;
  private lastFrameTime = Date.now();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor(camera: Camera, mqttPublisher: MqttPublisher, frameQueue: FrameQueue) {
    this.camera = camera;
    this.mqttPublisher = mqttPublisher;
    this.frameQueue = frameQueue;
    
    this.healthStatus = {
      service: 'camera-ingest',
      cameraId: camera.id,
      status: 'healthy',
      timestamp: new Date(),
      fps: 0,
      resolution: camera.resolution,
      lastFrame: new Date()
    };
  }

  async start(): Promise<void> {
    if (this.ffmpeg) {
      throw new Error('Camera stream is already running');
    }

    await this.startFFmpegStream();
  }

  async stop(): Promise<void> {
    if (this.ffmpeg) {
      this.ffmpeg.kill('SIGTERM');
      this.ffmpeg = null;
    }
  }

  private async startFFmpegStream(): Promise<void> {
    const inputUrl = this.getInputUrl();
    const fps = this.camera.fps || 5;
    const resolution = this.parseResolution(this.camera.resolution);

    const ffmpegArgs = [
      '-rtsp_transport', 'tcp',
      '-i', inputUrl,
      '-vf', `fps=${fps},scale=${resolution.width}:-1`,
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-q:v', '2',
      '-'
    ];

    console.log(`Starting FFmpeg for camera ${this.camera.id}:`, ffmpegArgs.join(' '));

    this.ffmpeg = spawn('ffmpeg', ffmpegArgs);
    
    this.ffmpeg.stdout.on('data', (data) => {
      this.processFrame(data);
    });

    this.ffmpeg.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('error') || message.includes('Error')) {
        console.error(`FFmpeg error for camera ${this.camera.id}:`, message);
      }
    });

    this.ffmpeg.on('close', (code) => {
      console.log(`FFmpeg process for camera ${this.camera.id} exited with code ${code}`);
      this.ffmpeg = null;
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect camera ${this.camera.id} (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.startFFmpegStream(), this.reconnectDelay);
      } else {
        this.updateHealthStatus('unhealthy', 'Max reconnection attempts reached');
      }
    });

    this.ffmpeg.on('error', (error) => {
      console.error(`FFmpeg process error for camera ${this.camera.id}:`, error);
      this.updateHealthStatus('unhealthy', error.message);
    });
  }

  private getInputUrl(): string {
    switch (this.camera.type) {
      case 'rtsp':
        return this.camera.rtsp_url || '';
      case 'usb':
        return `/dev/video${this.camera.location.match(/\d+/)?.[0] || '0'}`;
      case 'onvif':
        // Basic ONVIF URL construction - would need proper ONVIF library for full implementation
        return `rtsp://${this.camera.location}/onvif1`;
      default:
        throw new Error(`Unsupported camera type: ${this.camera.type}`);
    }
  }

  private parseResolution(resolution: string): { width: number; height: number } {
    const [width, height] = resolution.split('x').map(Number);
    return { width: width || 640, height: height || 480 };
  }

  private processFrame(data: Buffer): void {
    try {
      // Save frame to queue for inference
      const frameId = uuidv4();
      const timestamp = new Date();
      
      this.frameQueue.push({
        id: frameId,
        cameraId: this.camera.id,
        timestamp,
        data
      });

      // Update health status
      this.frameCount++;
      const now = Date.now();
      const fps = Math.round(1000 / (now - this.lastFrameTime));
      this.lastFrameTime = now;

      this.updateHealthStatus('healthy', undefined, fps);
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful frame

    } catch (error) {
      console.error(`Error processing frame for camera ${this.camera.id}:`, error);
      this.updateHealthStatus('warning', 'Frame processing error');
    }
  }

  private updateHealthStatus(status: 'healthy' | 'unhealthy' | 'warning', details?: string, fps?: number): void {
    this.healthStatus.status = status;
    this.healthStatus.timestamp = new Date();
    this.healthStatus.lastFrame = new Date();
    
    if (details) {
      this.healthStatus.details = { ...this.healthStatus.details, error: details };
    }
    
    if (fps !== undefined) {
      this.healthStatus.fps = fps;
    }

    // Publish health status to MQTT
    this.mqttPublisher.publishCameraHealth(this.camera.id, this.healthStatus);
  }

  getHealthStatus(): CameraHealth {
    return { ...this.healthStatus };
  }
}

export interface FrameQueue {
  push(frame: CameraFrame): void;
  getSize(): number;
}

export interface CameraFrame {
  id: string;
  cameraId: string;
  timestamp: Date;
  data: Buffer;
}