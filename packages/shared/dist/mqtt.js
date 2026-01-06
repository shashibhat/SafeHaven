"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MQTTSubscriber = exports.MQTTPublisher = exports.MqttSubscriber = exports.MqttPublisher = exports.MQTT_TOPICS = void 0;
const mqtt_1 = require("mqtt");
exports.MQTT_TOPICS = {
    // Detection topics
    DETECTIONS_MOTION: (cameraId) => `detections/${cameraId}/motion`,
    DETECTIONS_OBJECTS: (cameraId) => `detections/${cameraId}/objects`,
    DETECTIONS_FACES: (cameraId) => `detections/${cameraId}/faces`,
    DETECTIONS_GESTURES: (cameraId) => `detections/${cameraId}/gestures`,
    // Incident topics
    INCIDENTS: (cameraId) => `incidents/${cameraId}`,
    // Action topics
    ACTIONS_EXECUTE: 'actions/execute',
    // Health topics
    HEALTH_SERVICE: (service) => `health/${service}`,
    HEALTH_CAMERA: (cameraId) => `health/camera/${cameraId}`,
    // System topics
    HOUSEHOLD_MODE: 'system/household-mode',
    SYSTEM_SHUTDOWN: 'system/shutdown',
    SYSTEM_RESTART: 'system/restart'
};
class MqttPublisher {
    constructor(client) {
        this.client = client;
    }
    publishDetection(cameraId, type, payload) {
        const topic = this.getDetectionTopic(cameraId, type);
        this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
    }
    publishIncident(cameraId, payload) {
        const topic = exports.MQTT_TOPICS.INCIDENTS(cameraId);
        this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
    }
    publishAction(payload) {
        this.client.publish(exports.MQTT_TOPICS.ACTIONS_EXECUTE, JSON.stringify(payload), { qos: 1 });
    }
    publishHealth(service, status) {
        const topic = exports.MQTT_TOPICS.HEALTH_SERVICE(service);
        this.client.publish(topic, JSON.stringify(status), { qos: 1, retain: true });
    }
    publishCameraHealth(cameraId, status) {
        const topic = exports.MQTT_TOPICS.HEALTH_CAMERA(cameraId);
        this.client.publish(topic, JSON.stringify(status), { qos: 1, retain: true });
    }
    publishHouseholdMode(mode) {
        this.client.publish(exports.MQTT_TOPICS.HOUSEHOLD_MODE, JSON.stringify(mode), { qos: 1, retain: true });
    }
    getDetectionTopic(cameraId, type) {
        switch (type) {
            case 'motion':
                return exports.MQTT_TOPICS.DETECTIONS_MOTION(cameraId);
            case 'objects':
                return exports.MQTT_TOPICS.DETECTIONS_OBJECTS(cameraId);
            case 'faces':
                return exports.MQTT_TOPICS.DETECTIONS_FACES(cameraId);
            case 'gestures':
                return exports.MQTT_TOPICS.DETECTIONS_GESTURES(cameraId);
            default:
                throw new Error(`Unknown detection type: ${type}`);
        }
    }
}
exports.MqttPublisher = MqttPublisher;
class MqttSubscriber {
    constructor(client) {
        this.client = client;
    }
    subscribeToDetections(cameraId, type, callback) {
        const topic = this.getDetectionTopic(cameraId, type);
        this.client.subscribe(topic);
        this.client.on('message', (receivedTopic, message) => {
            if (receivedTopic === topic) {
                callback(JSON.parse(message.toString()));
            }
        });
    }
    subscribeToIncidents(cameraId, callback) {
        const topic = exports.MQTT_TOPICS.INCIDENTS(cameraId);
        this.client.subscribe(topic);
        this.client.on('message', (receivedTopic, message) => {
            if (receivedTopic === topic) {
                callback(JSON.parse(message.toString()));
            }
        });
    }
    subscribeToActions(callback) {
        this.client.subscribe(exports.MQTT_TOPICS.ACTIONS_EXECUTE);
        this.client.on('message', (receivedTopic, message) => {
            if (receivedTopic === exports.MQTT_TOPICS.ACTIONS_EXECUTE) {
                callback(JSON.parse(message.toString()));
            }
        });
    }
    subscribeToHealth(service, callback) {
        const topic = exports.MQTT_TOPICS.HEALTH_SERVICE(service);
        this.client.subscribe(topic);
        this.client.on('message', (receivedTopic, message) => {
            if (receivedTopic === topic) {
                callback(JSON.parse(message.toString()));
            }
        });
    }
    subscribeToCameraHealth(cameraId, callback) {
        const topic = exports.MQTT_TOPICS.HEALTH_CAMERA(cameraId);
        this.client.subscribe(topic);
        this.client.on('message', (receivedTopic, message) => {
            if (receivedTopic === topic) {
                callback(JSON.parse(message.toString()));
            }
        });
    }
    subscribeToHouseholdMode(callback) {
        this.client.subscribe(exports.MQTT_TOPICS.HOUSEHOLD_MODE);
        this.client.on('message', (receivedTopic, message) => {
            if (receivedTopic === exports.MQTT_TOPICS.HOUSEHOLD_MODE) {
                callback(JSON.parse(message.toString()));
            }
        });
    }
    getDetectionTopic(cameraId, type) {
        switch (type) {
            case 'motion':
                return exports.MQTT_TOPICS.DETECTIONS_MOTION(cameraId);
            case 'objects':
                return exports.MQTT_TOPICS.DETECTIONS_OBJECTS(cameraId);
            case 'faces':
                return exports.MQTT_TOPICS.DETECTIONS_FACES(cameraId);
            case 'gestures':
                return exports.MQTT_TOPICS.DETECTIONS_GESTURES(cameraId);
            default:
                throw new Error(`Unknown detection type: ${type}`);
        }
    }
}
exports.MqttSubscriber = MqttSubscriber;
class MQTTPublisher {
    constructor(config) {
        this.config = config;
        this.client = null;
    }
    async connect() {
        this.client = (0, mqtt_1.connect)(`mqtt://${this.config.host}:${this.config.port}`, {
            username: this.config.username,
            password: this.config.password,
            protocolVersion: 5,
        });
        await new Promise((resolve, reject) => {
            if (!this.client)
                return reject(new Error('Client not initialized'));
            this.client.once('connect', () => resolve());
            this.client.once('error', (e) => reject(e));
        });
    }
    async disconnect() {
        if (this.client)
            this.client.end(true);
        this.client = null;
    }
    async publishStatus(service, status, details) {
        if (!this.client)
            return;
        const payload = {
            service,
            status: status === 'online' ? 'healthy' : 'unhealthy',
            timestamp: new Date(),
            details,
        };
        this.client.publish(exports.MQTT_TOPICS.HEALTH_SERVICE(service), JSON.stringify(payload), { qos: 1, retain: true });
    }
    publishDetectionEvent(cameraId, event) {
        if (!this.client)
            return;
        this.client.publish('security/events/new', JSON.stringify({ cameraId, ...event }), { qos: 1 });
    }
    publishMotionEvent(cameraId, event) {
        if (!this.client)
            return;
        this.client.publish('security/events/new', JSON.stringify({ cameraId, ...event }), { qos: 1 });
    }
    publishActionResult(actionId, result) {
        if (!this.client)
            return;
        this.client.publish('security/alerts/notification', JSON.stringify({ actionId, ...result }), { qos: 1 });
    }
    publishRecordingStarted(recordingId, cameraId, duration) {
        if (!this.client)
            return;
        this.client.publish('security/cameras/status', JSON.stringify({ recordingId, cameraId, state: 'started', duration }), { qos: 1 });
    }
    publishRecordingStopped(recordingId) {
        if (!this.client)
            return;
        this.client.publish('security/cameras/status', JSON.stringify({ recordingId, state: 'stopped' }), { qos: 1 });
    }
}
exports.MQTTPublisher = MQTTPublisher;
class MQTTSubscriber {
    constructor(config) {
        this.config = config;
        this.client = null;
    }
    async connect() {
        this.client = (0, mqtt_1.connect)(`mqtt://${this.config.host}:${this.config.port}`, {
            username: this.config.username,
            password: this.config.password,
            protocolVersion: 5,
        });
        await new Promise((resolve, reject) => {
            if (!this.client)
                return reject(new Error('Client not initialized'));
            this.client.once('connect', () => resolve());
            this.client.once('error', (e) => reject(e));
        });
    }
    async disconnect() {
        if (this.client)
            this.client.end(true);
        this.client = null;
    }
    async subscribe(topic, handler) {
        if (!this.client)
            return;
        await new Promise((resolve, reject) => {
            this.client.subscribe(topic, { qos: 1 }, (err) => (err ? reject(err) : resolve()));
        });
        this.client.on('message', (t, m) => {
            if (!topic || t.match(new RegExp('^' + topic.replace('+', '[^/]+').replace('#', '.*') + '$'))) {
                handler(t, m);
            }
        });
    }
}
exports.MQTTSubscriber = MQTTSubscriber;
//# sourceMappingURL=mqtt.js.map