import { MqttClient, connect } from 'mqtt';
import { 
  DetectionPayload, 
  IncidentPayload, 
  ActionPayload, 
  HealthStatus, 
  CameraHealth,
  HouseholdMode 
} from './types';

export const MQTT_TOPICS = {
  // Detection topics
  DETECTIONS_MOTION: (cameraId: string) => `detections/${cameraId}/motion`,
  DETECTIONS_OBJECTS: (cameraId: string) => `detections/${cameraId}/objects`,
  DETECTIONS_FACES: (cameraId: string) => `detections/${cameraId}/faces`,
  DETECTIONS_GESTURES: (cameraId: string) => `detections/${cameraId}/gestures`,
  
  // Incident topics
  INCIDENTS: (cameraId: string) => `incidents/${cameraId}`,
  
  // Action topics
  ACTIONS_EXECUTE: 'actions/execute',
  
  // Health topics
  HEALTH_SERVICE: (service: string) => `health/${service}`,
  HEALTH_CAMERA: (cameraId: string) => `health/camera/${cameraId}`,
  
  // System topics
  HOUSEHOLD_MODE: 'system/household-mode',
  SYSTEM_SHUTDOWN: 'system/shutdown',
  SYSTEM_RESTART: 'system/restart'
} as const;

export class MqttPublisher {
  constructor(private client: MqttClient) {}

  publishDetection(cameraId: string, type: 'motion' | 'objects' | 'faces' | 'gestures', payload: DetectionPayload) {
    const topic = this.getDetectionTopic(cameraId, type);
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }

  publishIncident(cameraId: string, payload: IncidentPayload) {
    const topic = MQTT_TOPICS.INCIDENTS(cameraId);
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }

  publishAction(payload: ActionPayload) {
    this.client.publish(MQTT_TOPICS.ACTIONS_EXECUTE, JSON.stringify(payload), { qos: 1 });
  }

  publishHealth(service: string, status: HealthStatus) {
    const topic = MQTT_TOPICS.HEALTH_SERVICE(service);
    this.client.publish(topic, JSON.stringify(status), { qos: 1, retain: true });
  }

  publishCameraHealth(cameraId: string, status: CameraHealth) {
    const topic = MQTT_TOPICS.HEALTH_CAMERA(cameraId);
    this.client.publish(topic, JSON.stringify(status), { qos: 1, retain: true });
  }

  publishHouseholdMode(mode: HouseholdMode) {
    this.client.publish(MQTT_TOPICS.HOUSEHOLD_MODE, JSON.stringify(mode), { qos: 1, retain: true });
  }

  private getDetectionTopic(cameraId: string, type: 'motion' | 'objects' | 'faces' | 'gestures'): string {
    switch (type) {
      case 'motion':
        return MQTT_TOPICS.DETECTIONS_MOTION(cameraId);
      case 'objects':
        return MQTT_TOPICS.DETECTIONS_OBJECTS(cameraId);
      case 'faces':
        return MQTT_TOPICS.DETECTIONS_FACES(cameraId);
      case 'gestures':
        return MQTT_TOPICS.DETECTIONS_GESTURES(cameraId);
      default:
        throw new Error(`Unknown detection type: ${type}`);
    }
  }
}

export class MqttSubscriber {
  constructor(private client: MqttClient) {}

  subscribeToDetections(cameraId: string, type: 'motion' | 'objects' | 'faces' | 'gestures', callback: (payload: DetectionPayload) => void) {
    const topic = this.getDetectionTopic(cameraId, type);
    this.client.subscribe(topic);
    this.client.on('message', (receivedTopic, message) => {
      if (receivedTopic === topic) {
        callback(JSON.parse(message.toString()));
      }
    });
  }

  subscribeToIncidents(cameraId: string, callback: (payload: IncidentPayload) => void) {
    const topic = MQTT_TOPICS.INCIDENTS(cameraId);
    this.client.subscribe(topic);
    this.client.on('message', (receivedTopic, message) => {
      if (receivedTopic === topic) {
        callback(JSON.parse(message.toString()));
      }
    });
  }

  subscribeToActions(callback: (payload: ActionPayload) => void) {
    this.client.subscribe(MQTT_TOPICS.ACTIONS_EXECUTE);
    this.client.on('message', (receivedTopic, message) => {
      if (receivedTopic === MQTT_TOPICS.ACTIONS_EXECUTE) {
        callback(JSON.parse(message.toString()));
      }
    });
  }

  subscribeToHealth(service: string, callback: (status: HealthStatus) => void) {
    const topic = MQTT_TOPICS.HEALTH_SERVICE(service);
    this.client.subscribe(topic);
    this.client.on('message', (receivedTopic, message) => {
      if (receivedTopic === topic) {
        callback(JSON.parse(message.toString()));
      }
    });
  }

  subscribeToCameraHealth(cameraId: string, callback: (status: CameraHealth) => void) {
    const topic = MQTT_TOPICS.HEALTH_CAMERA(cameraId);
    this.client.subscribe(topic);
    this.client.on('message', (receivedTopic, message) => {
      if (receivedTopic === topic) {
        callback(JSON.parse(message.toString()));
      }
    });
  }

  subscribeToHouseholdMode(callback: (mode: HouseholdMode) => void) {
    this.client.subscribe(MQTT_TOPICS.HOUSEHOLD_MODE);
    this.client.on('message', (receivedTopic, message) => {
      if (receivedTopic === MQTT_TOPICS.HOUSEHOLD_MODE) {
        callback(JSON.parse(message.toString()));
      }
    });
  }

  private getDetectionTopic(cameraId: string, type: 'motion' | 'objects' | 'faces' | 'gestures'): string {
    switch (type) {
      case 'motion':
        return MQTT_TOPICS.DETECTIONS_MOTION(cameraId);
      case 'objects':
        return MQTT_TOPICS.DETECTIONS_OBJECTS(cameraId);
      case 'faces':
        return MQTT_TOPICS.DETECTIONS_FACES(cameraId);
      case 'gestures':
        return MQTT_TOPICS.DETECTIONS_GESTURES(cameraId);
      default:
        throw new Error(`Unknown detection type: ${type}`);
    }
  }
}

export class MQTTPublisher {
  private client: MqttClient | null = null;
  constructor(private config: { host: string; port: number; username?: string; password?: string }) {}

  async connect(): Promise<void> {
    this.client = connect(`mqtt://${this.config.host}:${this.config.port}`, {
      username: this.config.username,
      password: this.config.password,
      protocolVersion: 5,
    });
    await new Promise<void>((resolve, reject) => {
      if (!this.client) return reject(new Error('Client not initialized'));
      this.client.once('connect', () => resolve());
      this.client.once('error', (e) => reject(e));
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) this.client.end(true);
    this.client = null;
  }

  async publishStatus(service: string, status: 'online' | 'offline', details?: Record<string, any>): Promise<void> {
    if (!this.client) return;
    const payload = {
      service,
      status: status === 'online' ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      details,
    };
    this.client.publish(MQTT_TOPICS.HEALTH_SERVICE(service), JSON.stringify(payload), { qos: 1, retain: true });
  }

  publishDetectionEvent(cameraId: string, event: Record<string, any>): void {
    if (!this.client) return;
    this.client.publish('security/events/new', JSON.stringify({ cameraId, ...event }), { qos: 1 });
  }

  publishMotionEvent(cameraId: string, event: Record<string, any>): void {
    if (!this.client) return;
    this.client.publish('security/events/new', JSON.stringify({ cameraId, ...event }), { qos: 1 });
  }

  publishActionResult(actionId: string, result: Record<string, any>): void {
    if (!this.client) return;
    this.client.publish('security/alerts/notification', JSON.stringify({ actionId, ...result }), { qos: 1 });
  }

  publishRecordingStarted(recordingId: string, cameraId: string, duration: number): void {
    if (!this.client) return;
    this.client.publish('security/cameras/status', JSON.stringify({ recordingId, cameraId, state: 'started', duration }), { qos: 1 });
  }

  publishRecordingStopped(recordingId: string): void {
    if (!this.client) return;
    this.client.publish('security/cameras/status', JSON.stringify({ recordingId, state: 'stopped' }), { qos: 1 });
  }
}

export class MQTTSubscriber {
  private client: MqttClient | null = null;
  constructor(private config: { host: string; port: number; username?: string; password?: string }) {}

  async connect(): Promise<void> {
    this.client = connect(`mqtt://${this.config.host}:${this.config.port}`, {
      username: this.config.username,
      password: this.config.password,
      protocolVersion: 5,
    });
    await new Promise<void>((resolve, reject) => {
      if (!this.client) return reject(new Error('Client not initialized'));
      this.client.once('connect', () => resolve());
      this.client.once('error', (e) => reject(e));
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) this.client.end(true);
    this.client = null;
  }

  async subscribe(topic: string, handler: (topic: string, message: Buffer) => void): Promise<void> {
    if (!this.client) return;
    await new Promise<void>((resolve, reject) => {
      this.client!.subscribe(topic, { qos: 1 }, (err) => (err ? reject(err) : resolve()));
    });
    this.client.on('message', (t, m) => {
      if (!topic || t.match(new RegExp('^' + topic.replace('+', '[^/]+').replace('#', '.*') + '$'))) {
        handler(t, m);
      }
    });
  }
}
