import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

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
    const timestamp = new Date().toLocaleTimeString();
    const newEvent = { id: Date.now(), timestamp, message: event };
    setEvents(prev => [newEvent, ...prev].slice(0, 50));
    
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = 0;
    }
  };

  const startSession = async () => {
    try {
      setStatusText('Starting session...');
      setStatusColor('blue');
      
      const response = await fetch(`${API_BASE}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          candidateName: 'Test Candidate',
          examId: 'exam-123',
          metadata: {
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setSessionId(data.sessionId);
      setIsMonitoring(true);
      setStatusText(STATUS.MONITORING);
      setStatusColor('green');
      logEvent('Session started successfully');
      
      // Start the detection loop
      startDetection();
      
    } catch (error) {
      console.error('Error starting session:', error);
      setStatusText('Failed to start session');
      setStatusColor('red');
      logEvent(`Error starting session: ${error.message}`);
    }
  };

  const endSession = async () => {
    try {
      setStatusText('Ending session...');
      setStatusColor('blue');
      
      if (sessionId) {
        const response = await fetch(`${API_BASE}/api/session/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId,
            endReason: 'user_ended',
            metadata: {
              status: statusText,
              eventCount: events.length
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        logEvent('Session ended successfully');
      }
    } catch (error) {
      console.error('Error ending session:', error);
      logEvent(`Error ending session: ${error.message}`);
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
