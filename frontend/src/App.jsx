import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import './App.css';

// Get API base URL from environment variables
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const API_PREFIX = '/api';

// Log environment for debugging
console.log('Environment:', {
  NODE_ENV: import.meta.env.NODE_ENV,
  VITE_NODE_ENV: import.meta.env.VITE_NODE_ENV,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  API_BASE
});

const STATUS = {
  IDLE: 'Idle',
  MONITORING: 'Monitoring',
  NO_FACE: 'No Face Detected',
  MULTIPLE_FACES: 'Multiple Faces Detected',
  SUSPICIOUS_ACTIVITY: 'Suspicious Activity Detected',
  FOCUSED: 'Focused'
};

export default function App() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [statusText, setStatusText] = useState('Idle');
  const [statusColor, setStatusColor] = useState('gray');
  const [events, setEvents] = useState([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cocoModel, setCocoModel] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionInterval = useRef(null);
  const eventLogRef = useRef(null);

  // Load ML models
  useEffect(() => {
    const loadModels = async () => {
      try {
        // Load face-api.js models
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        
        // Load COCO-SSD model
        const cocoModel = await cocoSsd.load();
        setCocoModel(cocoModel);
        
        setModelsLoaded(true);
        logEvent('AI models loaded successfully');
      } catch (error) {
        console.error('Error loading models:', error);
        logEvent(`Error loading AI models: ${error.message}`);
      }
    };

    loadModels();
    
    // Cleanup function to clear intervals
    return () => {
      if (detectionInterval.current) {
        clearInterval(detectionInterval.current);
      }
    };
  }, []);

  // Start/Stop monitoring based on session
  useEffect(() => {
    if (sessionId && modelsLoaded) {
      startDetection();
    } else if (!sessionId && detectionInterval.current) {
      stopDetection();
    }
    
    return () => stopDetection();
  }, [sessionId, modelsLoaded]);

  const startDetection = () => {
    stopDetection(); // Clear any existing interval
    detectionInterval.current = setInterval(tick, 1000);
    setStatusText(STATUS.MONITORING);
    setStatusColor('green');
  };

  const stopDetection = () => {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
    if (!sessionId) {
      setStatusText(STATUS.IDLE);
    }
  };

  const tick = async () => {
    if (!webcamRef.current?.video || !canvasRef.current) return;
    
    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    try {
      // Face detection
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks(true);

      if (detections.length === 0) {
        setStatusText(STATUS.NO_FACE);
        setStatusColor('red');
        logEvent('No face detected');
      } else if (detections.length > 1) {
        setStatusText(STATUS.MULTIPLE_FACES);
        setStatusColor('red');
        logEvent('Multiple faces detected');
      } else {
        const detection = detections[0];
        const box = detection.detection.box;
        
        // Draw face box
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        // Draw landmarks
        const landmarks = detection.landmarks;
        ctx.fillStyle = '#00FF00';
        for (let i = 0; i < landmarks.positions.length; i++) {
          const pos = landmarks.positions[i];
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 2, 0, 2 * Math.PI);
          ctx.fill();
        }
        
        // Check if face is centered and of good size
        const faceArea = box.width * box.height;
        const frameArea = canvas.width * canvas.height;
        const faceRatio = faceArea / frameArea;
        
        if (faceRatio < 0.1) {
          setStatusText('Move closer');
          setStatusColor('orange');
        } else if (faceRatio > 0.3) {
          setStatusText('Move back');
          setStatusColor('orange');
        } else {
          setStatusText(STATUS.FOCUSED);
          setStatusColor('green');
        }
      }
      
      // Object detection
      if (cocoModel) {
        const predictions = await cocoModel.detect(video);
        let suspiciousActivityDetected = false;
        
        // Draw object detections
        for (const prediction of predictions) {
          // Only care about certain classes
          const suspiciousObjects = ['cell phone', 'book', 'laptop', 'mouse', 'keyboard', 'book'];
          if (suspiciousObjects.includes(prediction.class)) {
            suspiciousActivityDetected = true;
            
            // Draw bounding box
            const [x, y, width, height] = prediction.bbox;
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            // Draw label with background for better visibility
            const text = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
            const textWidth = ctx.measureText(text).width;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(x - 2, y - 20, textWidth + 4, 20);
            
            ctx.fillStyle = '#FF0000';
            ctx.font = '14px Arial';
            ctx.fillText(text, x, y > 10 ? y - 5 : 10);
            
            // Log suspicious object
            logEvent(`Suspicious object detected: ${prediction.class}`);
          }
        }
        
        if (suspiciousActivityDetected) {
          setStatusText(STATUS.SUSPICIOUS_ACTIVITY);
          setStatusColor('red');
        }
      }
    } catch (error) {
      console.error('Error in detection:', error);
      logEvent(`Detection error: ${error.message}`);
    }
  };

  const logEvent = (event) => {
    try {
      // Handle both string and object events
      const isObject = typeof event === 'object' && event !== null;
      const timestamp = new Date();
      
      const newEvent = {
        id: Date.now(),
        timestamp: timestamp.toISOString(),
        timeDisplay: timestamp.toLocaleTimeString(),
        type: isObject ? event.type || 'info' : 'info',
        message: isObject ? event.message || '' : event,
        severity: isObject ? event.severity || 'info' : 'info',
        ...(isObject ? { metadata: event.metadata || {} } : {})
      };
      
      setEvents(prev => [newEvent, ...prev].slice(0, 100));
      
      // Auto-scroll the event log
      if (eventLogRef.current) {
        eventLogRef.current.scrollTop = 0;
      }
      
      // Optionally send event to backend if session is active
      if (sessionId && isObject && event.sendToServer !== false) {
        // Don't await this to avoid blocking the UI
        fetch(`${API_BASE}${API_PREFIX}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            type: newEvent.type,
            details: newEvent.metadata,
            timestamp: newEvent.timestamp,
            severity: newEvent.severity
          })
        }).catch(err => {
          console.error('Failed to log event to server:', err);
        });
      }
    } catch (error) {
      console.error('Error in logEvent:', error);
    }
  };

  const startSession = async () => {
    try {
      setStatusText('Starting session...');
      setStatusColor('blue');
      
      console.log('Starting new proctoring session...');
      const response = await fetch(`${API_BASE}${API_PREFIX}/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          candidateName: 'Test Candidate',
          examId: 'exam-123',
          metadata: {
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            browser: {
              name: navigator.appName,
              version: navigator.appVersion,
              platform: navigator.platform,
              language: navigator.language
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            startTime: new Date().toISOString()
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorMsg = data.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      }
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to start session');
      }
      
      console.log('Session started with ID:', data.sessionId);
      setSessionId(data.sessionId);
      setIsMonitoring(true);
      setStatusText(STATUS.MONITORING);
      setStatusColor('green');
      
      // Log successful session start
      logEvent({
        type: 'session_start',
        message: 'Proctoring session started',
        metadata: {
          sessionId: data.sessionId,
          startTime: new Date().toISOString()
        }
      });
      
      // Start the detection loop
      startDetection();
      
    } catch (error) {
      console.error('Error starting session:', error);
      const errorMessage = error.message || 'Failed to start session';
      setStatusText('Failed to start session');
      setStatusColor('red');
      logEvent({
        type: 'error',
        message: `Error starting session: ${errorMessage}`,
        severity: 'error'
      });
    }
  };

  const endSession = async () => {
    try {
      if (!sessionId) {
        console.warn('No active session to end');
        return;
      }
      
      setStatusText('Ending session...');
      setStatusColor('blue');
      
      console.log('Ending session:', sessionId);
      const response = await fetch(`${API_BASE}${API_PREFIX}/session/end`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          sessionId,
          endReason: 'user_ended',
          metadata: {
            status: statusText,
            eventCount: events.length,
            endTime: new Date().toISOString(),
            duration: Math.floor((new Date() - new Date(events[0]?.timestamp)) / 1000) || 0
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorMsg = data.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      }
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to end session properly');
      }
      
      console.log('Session ended successfully:', sessionId);
      logEvent({
        type: 'session_end',
        message: 'Proctoring session ended',
        metadata: {
          sessionId,
          endTime: new Date().toISOString(),
          status: 'completed',
          eventCount: events.length
        }
      });
      
    } catch (error) {
      console.error('Error ending session:', error);
      logEvent({
        type: 'error',
        message: `Error ending session: ${error.message}`,
        severity: 'error'
      });
    } finally {
      // Stop detection and cleanup
      stopDetection();
      
      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      // Reset states
      setSessionId(null);
      setIsMonitoring(false);
      setStatusText(STATUS.IDLE);
      setStatusColor('gray');
      
      // Clear events after a short delay
      setTimeout(() => {
        setEvents([]);
      }, 2000);
    }
  };

  const getStatusClass = () => {
    switch (statusText) {
      case STATUS.IDLE:
        return 'status-idle';
      case STATUS.MONITORING:
      case STATUS.FOCUSED:
        return 'status-ok';
      case STATUS.NO_FACE:
      case STATUS.MULTIPLE_FACES:
      case STATUS.SUSPICIOUS_ACTIVITY:
        return 'status-error';
      default:
        return 'status-idle';
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>AI Proctoring System</h1>
          <div className="status-indicator">
            <span className="status-label">Status:</span>
            <span className={`status-dot ${getStatusClass()}`}></span>
            <span className="status-text">{statusText}</span>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="monitoring-section">
          <div className="video-feed">
            <div className="video-container">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  width: 1280,
                  height: 720,
                  facingMode: "user"
                }}
                className="webcam"
              />
              <canvas
                ref={canvasRef}
                className="detection-overlay"
              />
            </div>
            
            <div className="controls">
              {!modelsLoaded ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">
                    <div className="loading-title">Loading AI Models</div>
                    <div className="loading-subtitle">This may take a moment...</div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={isMonitoring ? endSession : startSession}
                  className={`btn btn-${isMonitoring ? 'stop' : 'start'}`}
                  disabled={!modelsLoaded}
                >
                  {isMonitoring ? (
                    <>
                      <span>Stop Monitoring</span>
                    </>
                  ) : (
                    <>
                     
                      <span>Start Monitoring</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          
          <div className="event-panel">
            <div className="panel-header">
              <h2>Activity Log</h2>
              <span className="event-count">{events.length} events</span>
            </div>
            <div className="event-log" ref={eventLogRef}>
              {events.length === 0 ? (
                <div className="empty-log">No events recorded yet</div>
              ) : (
                <div className="event-list">
                  {events.map(event => (
                    <div key={event.id} className="event-item">
                      <span className="event-time">[{event.timestamp}]</span>
                      <span className="event-message">{event.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      
    </div>
  );
}
