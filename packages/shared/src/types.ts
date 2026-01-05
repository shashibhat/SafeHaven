export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'user';
  created_at: Date;
}

export interface Camera {
  id: string;
  name: string;
  type: 'rtsp' | 'usb' | 'onvif';
  rtsp_url?: string;
  location: string;
  enabled: boolean;
  fps: number;
  resolution: string;
  created_at: Date;
}

export interface Zone {
  id: string;
  camera_id: string;
  name: string;
  polygon_json: string; // JSON string of polygon coordinates
  zone_type: 'doorway' | 'driveway' | 'porch' | 'garage_opening' | 'backyard' | 'custom';
}

export interface Model {
  id: string;
  name: string;
  type: 'builtin' | 'face_gallery' | 'custom_object' | 'custom_gesture';
  status: 'building' | 'ready' | 'error';
  created_at: Date;
  meta_json?: string;
}

export interface ModelClass {
  id: string;
  model_id: string;
  label: string;
  description?: string;
  action_preset_json?: string;
}

export interface TrainingSample {
  id: string;
  model_id: string;
  class_label: string;
  file_path: string;
  source: 'upload' | 'video_extract';
  created_at: Date;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  conditions_json: string;
  actions_json: string;
  cooldown_sec: number;
  schedule_json?: string;
}

export interface Event {
  id: string;
  ts: Date;
  camera_id: string;
  event_type: EventType;
  severity: 'info' | 'warn' | 'critical';
  payload_json: string;
  snapshot_path?: string;
  clip_path?: string;
}

export interface Incident {
  id: string;
  ts_start: Date;
  ts_end?: Date;
  camera_id: string;
  title: string;
  severity: 'info' | 'warn' | 'critical';
  status: 'active' | 'resolved';
  related_event_ids_json: string;
}

export type EventType = 
  | 'motion'
  | 'person'
  | 'package'
  | 'face_match'
  | 'door_open'
  | 'loitering'
  | 'tamper'
  | 'custom_match'
  | 'gesture_match';

export interface DetectionPayload {
  cameraId: string;
  ts: Date;
  bbox: [number, number, number, number]; // [x, y, width, height]
  label: string;
  confidence: number;
  zoneId?: string;
  snapshotPath?: string;
}

export interface IncidentPayload {
  cameraId: string;
  title: string;
  severity: 'info' | 'warn' | 'critical';
  eventIds: string[];
}

export interface ActionPayload {
  type: 'siren' | 'light' | 'tts' | 'push' | 'record_clip' | 'webhook';
  data: Record<string, any>;
}

export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  timestamp: Date;
  details?: Record<string, any>;
}

export interface CameraHealth extends HealthStatus {
  cameraId: string;
  fps?: number;
  resolution?: string;
  lastFrame?: Date;
}

export interface HouseholdMode {
  mode: 'home' | 'away' | 'sleep';
  changed_at: Date;
}

export interface CustomModelConfig {
  type: 'object' | 'gesture' | 'person';
  labels: string[];
  samples: string[];
  actionPreset: ActionPreset;
}

export interface ActionPreset {
  severity: 'info' | 'warn' | 'critical';
  actions: ActionPayload[];
  scope: {
    cameras: string[];
    zones?: string[];
    schedule?: string;
  };
}