import { create } from 'zustand'
import { Camera, DetectionPayload as DetectionEvent, Event, Rule, CustomModelConfig as CustomModel, Incident } from '@security-system/shared'
import { getMQTTService } from '../services/mqtt'
import { useAuthStore } from './auth'

interface SystemState {
  cameras: Camera[]
  events: Event[]
  detections: DetectionEvent[]
  rules: Rule[]
  customModels: CustomModel[]
  incidents: Incident[]
  systemStatus: {
    cameras: number
    online: number
    offline: number
    alerts: number
    status?: string
  }
  isConnected: boolean
  lastUpdate: Date | null
  mqttConnected: boolean
  
  // Actions
  setCameras: (cameras: Camera[]) => void
  setEvents: (events: Event[]) => void
  setDetections: (detections: DetectionEvent[]) => void
  setRules: (rules: Rule[]) => void
  setCustomModels: (models: CustomModel[]) => void
  setIncidents: (incidents: Incident[]) => void
  setSystemStatus: (status: SystemState['systemStatus']) => void
  setConnectionStatus: (connected: boolean) => void
  setMQTTConnected: (connected: boolean) => void
  addEvent: (event: Event) => void
  addDetection: (detection: DetectionEvent) => void
  addIncident: (incident: Incident) => void
  updateCamera: (cameraId: string, updates: Partial<Camera>) => void
  updateCameraStatus: (cameraId: string, status: 'online' | 'offline') => void
  initializeMQTT: () => Promise<void>
  fetchCameras: () => Promise<void>
  fetchEvents: () => Promise<void>
  fetchSystemStatus: () => Promise<void>
}

export const useSystemStore = create<SystemState>((set, get) => ({
  cameras: [],
  events: [],
  detections: [],
  rules: [],
  customModels: [],
  incidents: [],
  systemStatus: {
    cameras: 0,
    online: 0,
    offline: 0,
    alerts: 0,
    status: 'unknown',
  },
  isConnected: false,
  lastUpdate: null,
  mqttConnected: false,

  setCameras: (cameras) => set({ cameras, lastUpdate: new Date() }),
  setEvents: (events) => set({ events, lastUpdate: new Date() }),
  setDetections: (detections) => set({ detections, lastUpdate: new Date() }),
  setRules: (rules) => set({ rules, lastUpdate: new Date() }),
  setCustomModels: (customModels) => set({ customModels, lastUpdate: new Date() }),
  setIncidents: (incidents) => set({ incidents, lastUpdate: new Date() }),
  setSystemStatus: (systemStatus) => set({ systemStatus, lastUpdate: new Date() }),
  setConnectionStatus: (isConnected) => set({ isConnected, lastUpdate: new Date() }),
  setMQTTConnected: (mqttConnected) => set({ mqttConnected, lastUpdate: new Date() }),
  
  addEvent: (event) => set((state) => ({ 
    events: [event, ...state.events].slice(0, 1000), // Keep last 1000 events
    lastUpdate: new Date()
  })),
  
  addDetection: (detection) => set((state) => ({ 
    detections: [detection, ...state.detections].slice(0, 500), // Keep last 500 detections
    lastUpdate: new Date()
  })),
  
  addIncident: (incident) => set((state) => ({ 
    incidents: [incident, ...state.incidents].slice(0, 100), // Keep last 100 incidents
    lastUpdate: new Date()
  })),
  
  updateCamera: (cameraId, updates) => set((state) => ({
    cameras: state.cameras.map(camera => 
      camera.id === cameraId 
        ? { ...camera, ...updates }
        : camera
    ),
    lastUpdate: new Date()
  })),
  
  updateCameraStatus: (cameraId, status) => set((state) => {
    const updated = state.cameras.map((camera) =>
      camera.id === cameraId ? ({ ...(camera as any), status }) : camera
    ) as any[];
    const online = updated.filter((c) => (c as any).status === 'online').length;
    const offline = updated.filter((c) => (c as any).status === 'offline').length;
    return {
      cameras: updated as any,
      systemStatus: { ...state.systemStatus, online, offline },
      lastUpdate: new Date(),
    };
  }),

  initializeMQTT: async () => {
    try {
      const mqtt = getMQTTService();
      
      // Set up MQTT event listeners
      mqtt.on('connected', () => {
        set({ mqttConnected: true });
        console.log('MQTT connected in store');
      });

      mqtt.on('disconnected', () => {
        set({ mqttConnected: false });
        console.log('MQTT disconnected in store');
      });

      mqtt.on('event:new', (event: Event) => {
        get().addEvent(event);
        console.log('New event received via MQTT:', event);
      });

      mqtt.on('event:update', (event: Event) => {
        set((state) => ({
          events: state.events.map(e => e.id === event.id ? event : e)
        }));
        console.log('Event updated via MQTT:', event);
      });

      mqtt.on('incident:new', (incident: Incident) => {
        get().addIncident(incident);
        console.log('New incident received via MQTT:', incident);
      });

      mqtt.on('incident:update', (incident: Incident) => {
        set((state) => ({
          incidents: state.incidents.map(i => i.id === incident.id ? incident : i)
        }));
        console.log('Incident updated via MQTT:', incident);
      });

      mqtt.on('camera:status', (payload: { cameraId: string; status: 'online' | 'offline'; timestamp: number }) => {
        get().updateCameraStatus(payload.cameraId, payload.status);
        console.log('Camera status updated via MQTT:', payload);
      });

      mqtt.on('camera:frame', (payload: { cameraId: string; frame: string; timestamp: number }) => {
        // Handle live frame updates - could be used for real-time preview
        console.log('Camera frame received via MQTT:', payload.cameraId);
      });

      mqtt.on('rules:change', () => {
        // Trigger rules refresh
        console.log('Rules changed via MQTT');
      });

      mqtt.on('models:change', () => {
        // Trigger models refresh
        console.log('Models changed via MQTT');
      });

      mqtt.on('system:status', (payload: any) => {
        console.log('System status update via MQTT:', payload);
      });

      mqtt.on('alert:notification', (payload: { title: string; message: string; severity: 'low' | 'medium' | 'high' }) => {
        // Handle browser notifications
        if (Notification.permission === 'granted') {
          new Notification(payload.title, {
            body: payload.message,
            icon: '/favicon.ico'
          });
        }
        console.log('Alert notification via MQTT:', payload);
      });

      console.log('MQTT listeners set up successfully');

      await mqtt.connect();
      console.log('MQTT connection established');
    } catch (error) {
      console.error('Failed to initialize MQTT in store:', error);
    }
  },

  fetchCameras: async () => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch('/api/cameras', {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      if (!res.ok) throw new Error('Failed to fetch cameras')
      const apiCameras: any[] = await res.json()
      const mapped: any[] = apiCameras.map((c) => ({
        ...c,
        status: c.enabled ? 'online' : 'offline',
      }))
      set({ cameras: mapped as any, lastUpdate: new Date() })
    } catch (e) {
      console.error('fetchCameras error', e)
    }
  },

  fetchEvents: async () => {
    try {
      const token = useAuthStore.getState().token
      const res = await fetch('/api/events?limit=100', {
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      if (!res.ok) throw new Error('Failed to fetch events')
      const apiEvents: any[] = await res.json()
      const mapSeverity = (s: string) => (s === 'critical' ? 'high' : s === 'warn' ? 'medium' : 'low')
      const mapped: any[] = apiEvents.map((e) => ({
        id: e.id,
        type: e.event_type,
        severity: mapSeverity(e.severity),
        cameraName: e.camera_name,
        timestamp: e.ts,
        payload_json: e.payload_json,
      }))
      set({ events: mapped as any, lastUpdate: new Date() })
    } catch (e) {
      console.error('fetchEvents error', e)
    }
  },

  fetchSystemStatus: async () => {
    try {
      const res = await fetch('/health')
      const health = (await res.json()) as { status: string }
      const state = get()
      set({
        systemStatus: {
          cameras: state.cameras.length,
          online: state.cameras.filter((c: any) => c.status === 'online').length,
          offline: state.cameras.filter((c: any) => c.status === 'offline').length,
          alerts: state.events.filter((e: any) => e.severity === 'high').length,
          status: health.status,
        },
        lastUpdate: new Date(),
      })
    } catch (e) {
      console.error('fetchSystemStatus error', e)
    }
  },
}))
