-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'user')) NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cameras table
CREATE TABLE cameras (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('rtsp', 'usb', 'onvif')) NOT NULL,
  rtsp_url TEXT,
  location TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  fps INTEGER DEFAULT 5,
  resolution TEXT DEFAULT '640x480',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Zones table
CREATE TABLE zones (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL,
  name TEXT NOT NULL,
  polygon_json TEXT NOT NULL, -- JSON string of polygon coordinates
  zone_type TEXT CHECK(zone_type IN ('doorway', 'driveway', 'porch', 'garage_opening', 'backyard', 'custom')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
);

-- Models table
CREATE TABLE models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('builtin', 'face_gallery', 'custom_object', 'custom_gesture')) NOT NULL,
  status TEXT CHECK(status IN ('building', 'ready', 'error')) NOT NULL DEFAULT 'building',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  meta_json TEXT -- JSON metadata
);

-- Model classes table
CREATE TABLE model_classes (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  action_preset_json TEXT, -- JSON action preset configuration
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Training samples table
CREATE TABLE training_samples (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  class_label TEXT NOT NULL,
  file_path TEXT NOT NULL,
  source TEXT CHECK(source IN ('upload', 'video_extract')) NOT NULL,
  embedding_json TEXT, -- JSON embedding vector for KNN matching
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
);

-- Rules table
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  conditions_json TEXT NOT NULL, -- JSON conditions configuration
  actions_json TEXT NOT NULL, -- JSON actions configuration
  cooldown_sec INTEGER DEFAULT 300,
  schedule_json TEXT, -- JSON schedule configuration
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  ts DATETIME NOT NULL,
  camera_id TEXT NOT NULL,
  event_type TEXT CHECK(event_type IN ('motion', 'person', 'package', 'face_match', 'door_open', 'loitering', 'tamper', 'custom_match', 'gesture_match')) NOT NULL,
  severity TEXT CHECK(severity IN ('info', 'warn', 'critical')) NOT NULL,
  payload_json TEXT NOT NULL, -- JSON payload with detection details
  snapshot_path TEXT,
  clip_path TEXT,
  zone_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE,
  FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE SET NULL
);

-- Incidents table
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  ts_start DATETIME NOT NULL,
  ts_end DATETIME,
  camera_id TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('info', 'warn', 'critical')) NOT NULL,
  status TEXT CHECK(status IN ('active', 'resolved')) NOT NULL DEFAULT 'active',
  related_event_ids_json TEXT NOT NULL, -- JSON array of event IDs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE
);

-- Household mode table (singleton)
CREATE TABLE household_mode (
  id INTEGER PRIMARY KEY CHECK(id = 1), -- Singleton pattern
  mode TEXT CHECK(mode IN ('home', 'away', 'sleep')) NOT NULL DEFAULT 'home',
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System settings table
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_events_camera_id ON events(camera_id);
CREATE INDEX idx_events_ts ON events(ts);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_severity ON events(severity);
CREATE INDEX idx_incidents_camera_id ON incidents(camera_id);
CREATE INDEX idx_incidents_ts_start ON incidents(ts_start);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_zones_camera_id ON zones(camera_id);
CREATE INDEX idx_training_samples_model_id ON training_samples(model_id);
CREATE INDEX idx_model_classes_model_id ON model_classes(model_id);

-- Insert default admin user (password: admin123)
INSERT INTO users (id, email, password_hash, role) VALUES 
('default-admin', 'admin@security.local', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Insert default household mode
INSERT INTO household_mode (id, mode) VALUES (1, 'home');

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES 
('retention_days', '30', 'Number of days to retain events and clips'),
('face_storage_enabled', 'false', 'Whether to store face crops'),
('cloud_integration_enabled', 'false', 'Whether cloud integration is enabled'),
('inference_fps', '3', 'Frames per second for inference'),
('clip_duration_sec', '10', 'Duration of recorded clips in seconds');