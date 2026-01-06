import { MqttClient } from 'mqtt';
import { DetectionPayload, IncidentPayload, ActionPayload, HealthStatus, CameraHealth, HouseholdMode } from './types';
export declare const MQTT_TOPICS: {
    readonly DETECTIONS_MOTION: (cameraId: string) => string;
    readonly DETECTIONS_OBJECTS: (cameraId: string) => string;
    readonly DETECTIONS_FACES: (cameraId: string) => string;
    readonly DETECTIONS_GESTURES: (cameraId: string) => string;
    readonly INCIDENTS: (cameraId: string) => string;
    readonly ACTIONS_EXECUTE: "actions/execute";
    readonly HEALTH_SERVICE: (service: string) => string;
    readonly HEALTH_CAMERA: (cameraId: string) => string;
    readonly HOUSEHOLD_MODE: "system/household-mode";
    readonly SYSTEM_SHUTDOWN: "system/shutdown";
    readonly SYSTEM_RESTART: "system/restart";
};
export declare class MqttPublisher {
    private client;
    constructor(client: MqttClient);
    publishDetection(cameraId: string, type: 'motion' | 'objects' | 'faces' | 'gestures', payload: DetectionPayload): void;
    publishIncident(cameraId: string, payload: IncidentPayload): void;
    publishAction(payload: ActionPayload): void;
    publishHealth(service: string, status: HealthStatus): void;
    publishCameraHealth(cameraId: string, status: CameraHealth): void;
    publishHouseholdMode(mode: HouseholdMode): void;
    private getDetectionTopic;
}
export declare class MqttSubscriber {
    private client;
    constructor(client: MqttClient);
    subscribeToDetections(cameraId: string, type: 'motion' | 'objects' | 'faces' | 'gestures', callback: (payload: DetectionPayload) => void): void;
    subscribeToIncidents(cameraId: string, callback: (payload: IncidentPayload) => void): void;
    subscribeToActions(callback: (payload: ActionPayload) => void): void;
    subscribeToHealth(service: string, callback: (status: HealthStatus) => void): void;
    subscribeToCameraHealth(cameraId: string, callback: (status: CameraHealth) => void): void;
    subscribeToHouseholdMode(callback: (mode: HouseholdMode) => void): void;
    private getDetectionTopic;
}
export declare class MQTTPublisher {
    private config;
    private client;
    constructor(config: {
        host: string;
        port: number;
        username?: string;
        password?: string;
    });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    publishStatus(service: string, status: 'online' | 'offline', details?: Record<string, any>): Promise<void>;
    publishDetectionEvent(cameraId: string, event: Record<string, any>): void;
    publishMotionEvent(cameraId: string, event: Record<string, any>): void;
    publishActionResult(actionId: string, result: Record<string, any>): void;
    publishRecordingStarted(recordingId: string, cameraId: string, duration: number): void;
    publishRecordingStopped(recordingId: string): void;
}
export declare class MQTTSubscriber {
    private config;
    private client;
    constructor(config: {
        host: string;
        port: number;
        username?: string;
        password?: string;
    });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    subscribe(topic: string, handler: (topic: string, message: Buffer) => void): Promise<void>;
}
//# sourceMappingURL=mqtt.d.ts.map