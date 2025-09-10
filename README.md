# AI Proctoring Application

A comprehensive proctoring solution for online exams and interviews, featuring real-time monitoring using computer vision and AI.

## Features

- Real-time face detection and tracking
- Multiple faces detection
- Screen focus monitoring
- Suspicious object detection (phones, books, other devices)
- Event logging and session management
- Responsive web interface

## Tech Stack

### Frontend
- React 19
- Vite
- TensorFlow.js
- face-api.js
- React Webcam

### Backend
- Node.js with Express
- MongoDB (with Mongoose ODM)
- RESTful API

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB (local or cloud instance)
- Webcam
- Modern web browser with WebRTC support

## Setup Instructions

### 1. Clone the repository
```bash
git clone <repository-url>
cd proctoring-app
```

### 2. Set up the Backend
```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:
```env
PORT=4000
MONGO_URI=mongodb://localhost:27017/proctoring-app
NODE_ENV=development
```

### 3. Set up the Frontend
```bash
cd ../frontend
npm install
```

Create a `.env` file in the frontend directory:
```env
VITE_API_BASE=http://localhost:4000
```

### 4. Start MongoDB
Make sure MongoDB is running locally or update the `MONGO_URI` in the backend `.env` file to point to your MongoDB instance.

### 5. Run the Application

In one terminal, start the backend:
```bash
cd backend
npm run dev
```

In another terminal, start the frontend:
```bash
cd frontend
npm run dev
```

### 6. Access the Application
Open your browser and navigate to:
```
http://localhost:5173
```

## API Endpoints

### Session Management
- `POST /api/session/start` - Start a new proctoring session
- `POST /api/session/end` - End a proctoring session
- `GET /api/session/:sessionId` - Get session details

### Event Logging
- `POST /api/events` - Log a new proctoring event
- `GET /api/events/session/:sessionId` - Get events for a session

## Development

### Backend Development
```bash
cd backend
npm run dev  # Development server with hot-reload
```

### Frontend Development
```bash
cd frontend
npm run dev  # Development server with hot-reload
```

## Production Build

### Build Frontend
```bash
cd frontend
npm run build
```

### Start Production Server
```bash
cd backend
npm start
```

## License

This project is licensed under the MIT License.
