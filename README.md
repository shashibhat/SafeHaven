# 🛡️ Security System - Offline-First Home Security Platform

A comprehensive, offline-first home security system designed for Orange Pi 5 Plus that provides real-time camera monitoring, AI-powered detection, and intelligent alerting without requiring internet connectivity.

## ✨ Key Features

- **🏠 Offline-First Architecture**: Runs entirely on your local network without internet dependency
- **📹 Multi-Camera Support**: RTSP, USB, and ONVIF camera integration
- **🤖 Edge AI Processing**: Real-time object detection, person recognition, and custom model training
- **⚡ Real-time Processing**: Sub-second event detection and alerting
- **🎨 Modern Web UI**: Responsive React-based interface with live updates
- **🔧 Modular Architecture**: Microservices-based design with MQTT messaging
- **📱 Mobile Optimized**: Works great on phones and tablets
- **🔒 Privacy First**: All processing happens locally - no video leaves your device

## 🏗️ Architecture

The system uses a microservices architecture with MQTT as the message bus:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   Web API       │    │   MQTT Broker   │
│   (React/Vite)  │◄──►│   (Express.js)  │◄──►│   (Mosquitto)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                         │
                                ▼                         ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   SQLite DB     │    │ Camera Ingest   │
                       │                 │    │   Worker        │
                       └─────────────────┘    └─────────────────┘
                                                       │
                       ┌─────────────────┐             ▼
                       │   Rules Engine  │    ┌─────────────────┐
                       │                 │    │   Inference     │
                       └─────────────────┘    │   Worker        │
                                │             └─────────────────┘
                                ▼                         │
                       ┌─────────────────┐             ▼
                       │ Actions Service │    ┌─────────────────┐
                       │                 │    │   Custom Models   │
                       └─────────────────┘    │   (ONNX Runtime)  │
                                              └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)
- Orange Pi 5 Plus or similar ARM64 device (optimized for)

### Installation

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd security-system
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Deploy with Docker**
   ```bash
   docker-compose up -d
   ```

4. **Access the System**
   - Web UI: http://localhost:8080
   - API: http://localhost:3000
   - MQTT WebSocket: ws://localhost:9001

## 🧪 Local Testing (No Docker)

### Prerequisites
- Node.js 18+
- FFmpeg installed (`brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Linux)
- Mosquitto MQTT broker (`brew install mosquitto` on macOS, `sudo apt install mosquitto` on Linux)

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment for local dev
Create `.env` in project root with local overrides:
```env
JWT_SECRET=dev-secret-change-me

# API CORS origin (Vite dev server)
FRONTEND_URL=http://localhost:5173

# MQTT broker URLs
MQTT_BROKER_URL=mqtt://localhost:1883

# SQLite database path (used by API and workers)
DATABASE_PATH=./data/security.db

# Optional tuning
CONFIDENCE_THRESHOLD=0.5
RECORDING_DURATION=30
GPIO_ENABLED=false
```

### 3) Start MQTT broker locally
Create local data folder and start Mosquitto with WebSockets enabled:
```bash
mkdir -p configs mosquitto-data
mosquitto -c configs/mosquitto-local.conf
```

The local config listens on `1883` (MQTT) and `9001` (WebSocket). If you installed via Homebrew, you can also run:
```bash
brew services start mosquitto
```
Ensure a WebSocket listener on `9001` is enabled if using system service.

### 4) Start services in separate terminals
- API:
```bash
npm run dev --workspace=apps/api
```

- Camera Ingest:
```bash
npm run dev --workspace=workers/ingest
```

- Inference Worker:
```bash
npm run dev --workspace=workers/inference
```

- Rules Engine:
```bash
npm run dev --workspace=workers/rules-engine
```

- Actions Service:
```bash
npm run dev --workspace=workers/actions-service
```

- Web UI (Vite):
```bash
npm run dev --workspace=apps/web
```

Tip: You can also start API + UI + workers together:
```bash
npm run dev:local
```

### 5) Verify
- API health: `http://localhost:3001/health`
- UI: `http://localhost:5173`
- MQTT WebSocket: `ws://localhost:9001` (UI connects automatically)

### 6) First run checklist
- Add a camera in UI (RTSP URL)
- Confirm `Camera Ingest` logs show frames
- Confirm `Inference Worker` emits detections
- See events on the Timeline
- Build and deploy a Custom Detector in the Studio

### Troubleshooting (local)
- Web UI cannot connect: verify Mosquitto is running with WebSocket on `9001`
- CORS errors: set `FRONTEND_URL=http://localhost:5173` in `.env`
- Database missing: API initializes SQLite and applies migrations automatically on first start

### Default Credentials
- Username: `admin`
- Password: `admin123`

## 📋 Services Overview

| Service | Port | Description |
|---------|------|-------------|
| Web UI | 8080 | React-based frontend |
| API | 3000 | REST API and authentication |
| MQTT Broker | 1883/9001 | Message broker (MQTT/WebSocket) |
| Camera Ingest | - | RTSP stream processing |
| Inference | - | AI model processing |
| Rules Engine | - | Event rule processing |
| Actions | - | Alert and notification execution |

## 🔧 Configuration

### Environment Variables

Create a `.env` file with:

```env
# Security
JWT_SECRET=your-secret-key-here

# MQTT
MQTT_BROKER_URL=mqtt://mqtt:1883

# GPIO (for hardware actions)
GPIO_ENABLED=false

# Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Security System <your-email@gmail.com>

# Recording settings
RECORDING_DURATION=30
MAX_STORAGE_GB=100
```

### Camera Configuration

Cameras support multiple protocols:
- **RTSP**: `rtsp://username:password@ip:port/stream`
- **HTTP**: `http://ip:port/video.mjpg`
- **USB**: `/dev/video0`
- **ONVIF**: Auto-discovery supported

## 🤖 AI Models

### Pre-trained Models
- **Person Detection**: YOLO-based person identification
- **Motion Detection**: Frame difference analysis
- **Package Detection**: Package/courier identification
- **Face Recognition**: Basic face matching

### Custom Model Training
The system includes a "Detector Studio" for training custom models:
- Upload sample images
- Few-shot learning with embeddings
- Real-time model testing
- Easy deployment to production

## 📱 User Interface

### Dashboard
- Live camera tiles with real-time feeds
- System status overview
- Recent events timeline
- Quick action buttons

### Cameras
- Camera management and configuration
- Zone drawing for detection areas
- Stream quality settings
- Health monitoring

### Events
- Event timeline with filtering
- Event details with media playback
- Incident correlation
- Export capabilities

### Rules (IFTTT-style)
- Visual rule builder
- Multiple conditions and actions
- Time-based scheduling
- Custom notifications

### Custom Models
- Model training interface
- Dataset management
- Model testing and validation
- Deployment controls

### Settings
- System configuration
- User management
- Storage settings
- Network configuration

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Role-based Access**: Admin and user roles
- **Local Processing**: No cloud dependencies
- **Encrypted Storage**: Sensitive data encryption
- **Network Isolation**: Runs on local network only

## 📊 Performance

Optimized for Orange Pi 5 Plus:
- **4K Camera Support**: Up to 4 simultaneous 4K streams
- **Real-time Processing**: < 500ms detection latency
- **Efficient Storage**: Smart recording and cleanup
- **Memory Usage**: ~2GB RAM for full system
- **CPU Usage**: Optimized for ARM64 architecture

## 🛠️ Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Start development services
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure

```
security-system/
├── apps/
│   ├── api/           # Express.js API server
│   └── web/           # React frontend
├── workers/
│   ├── ingest/        # Camera stream processor
│   ├── inference/     # AI model worker
│   ├── rules-engine/  # Rule processing
│   └── actions-service/ # Action execution
├── packages/
│   └── shared/        # Shared types and utilities
├── migrations/        # Database schemas
└── docker/           # Docker configurations
```

## 📚 API Documentation

### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### Camera Management
```http
GET /api/cameras
POST /api/cameras
PUT /api/cameras/:id
DELETE /api/cameras/:id
```

### Events
```http
GET /api/events
GET /api/events/:id
POST /api/events/export
```

### Custom Models
```http
POST /api/custom-models/train
POST /api/custom-models/test
GET /api/custom-models/deploy/:id
```

## 🔧 Troubleshooting

### Common Issues

1. **Camera Connection Failed**
   - Check RTSP URL format
   - Verify network connectivity
   - Check camera credentials

2. **AI Detection Not Working**
   - Verify ONNX models are downloaded
   - Check inference worker logs
   - Ensure sufficient memory

3. **MQTT Connection Issues**
   - Verify Mosquitto is running
   - Check port availability
   - Review firewall settings

4. **Storage Full**
   - Adjust recording duration
   - Enable automatic cleanup
   - Check disk space

### Logs
```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f ingest
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built for Orange Pi 5 Plus
- Uses ONNX Runtime for AI inference
- Powered by React and Express.js
- MQTT messaging with Mosquitto

---

**⚠️ Important**: This is a security system designed for local deployment. Always follow security best practices and keep your system updated.
