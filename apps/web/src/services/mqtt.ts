import { MqttClient, connect } from 'mqtt';
import { EventEmitter } from 'events';
import { Camera, Event, Incident, Rule, CustomModel } from '@security-system/shared';

export interface MQTTMessage {
  topic: string;
  payload: any;
  timestamp: number;
}

export class MQTTService extends EventEmitter {
  private client: MqttClient | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    private brokerUrl: string = 'ws://localhost:9001',
    private clientId: string = `web-client-${Date.now()}`
  ) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.client = connect(this.brokerUrl, {
          clientId: this.clientId,
          clean: true,
          connectTimeout: 4000,
          reconnectPeriod: 1000,
          protocolVersion: 5,
        });

        this.client.on('connect', () => {
          console.log('MQTT connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.subscribeToTopics();
          this.emit('connected');
          resolve();
        });

        this.client.on('error', (error) => {
          console.error('MQTT error:', error);
          this.emit('error', error);
          if (!this.isConnected) {
            reject(error);
          }
        });

        this.client.on('disconnect', () => {
          console.log('MQTT disconnected');
          this.isConnected = false;
          this.emit('disconnected');
        });

        this.client.on('message', (topic, message) => {
          this.handleMessage(topic, message);
        });

        this.client.on('reconnect', () => {
          console.log('MQTT reconnecting...');
          this.reconnectAttempts++;
          if (this.reconnectAttempts > this.maxReconnectAttempts) {
            this.client?.end();
            this.emit('max_reconnects_exceeded');
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
    }
  }

  private subscribeToTopics(): void {
    if (!this.client) return;

    const topics = [
      'security/events/new',
      'security/events/update',
      'security/cameras/status',
      'security/cameras/frames',
      'security/incidents/new',
      'security/incidents/update',
      'security/rules/change',
      'security/models/change',
      'security/system/status',
      'security/alerts/notification'
    ];

    topics.forEach(topic => {
      this.client?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`Subscribed to ${topic}`);
        }
      });
    });
  }

  private handleMessage(topic: string, message: Buffer): void {
    try {
      const payload = JSON.parse(message.toString());
      const mqttMessage: MQTTMessage = {
        topic,
        payload,
        timestamp: Date.now()
      };

      console.log(`MQTT message received: ${topic}`, payload);
      this.emit('message', mqttMessage);

      // Emit specific events based on topic
      switch (topic) {
        case 'security/events/new':
          this.emit('event:new', payload as Event);
          break;
        case 'security/events/update':
          this.emit('event:update', payload as Event);
          break;
        case 'security/cameras/status':
          this.emit('camera:status', payload);
          break;
        case 'security/cameras/frames':
          this.emit('camera:frame', payload);
          break;
        case 'security/incidents/new':
          this.emit('incident:new', payload as Incident);
          break;
        case 'security/incidents/update':
          this.emit('incident:update', payload as Incident);
          break;
        case 'security/rules/change':
          this.emit('rules:change', payload);
          break;
        case 'security/models/change':
          this.emit('models:change', payload);
          break;
        case 'security/system/status':
          this.emit('system:status', payload);
          break;
        case 'security/alerts/notification':
          this.emit('alert:notification', payload);
          break;
      }
    } catch (error) {
      console.error('Failed to handle MQTT message:', error);
    }
  }

  publish(topic: string, payload: any): void {
    if (!this.client || !this.isConnected) {
      console.warn('MQTT not connected, cannot publish');
      return;
    }

    try {
      const message = JSON.stringify(payload);
      this.client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) {
          console.error(`Failed to publish to ${topic}:`, err);
        } else {
          console.log(`Published to ${topic}:`, payload);
        }
      });
    } catch (error) {
      console.error('Failed to publish MQTT message:', error);
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let mqttService: MQTTService | null = null;

export const getMQTTService = (): MQTTService => {
  if (!mqttService) {
    mqttService = new MQTTService();
  }
  return mqttService;
};

export const initializeMQTT = async (): Promise<MQTTService> => {
  const service = getMQTTService();
  await service.connect();
  return service;
};
