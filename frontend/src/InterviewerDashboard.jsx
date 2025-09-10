import { useState, useEffect, useRef } from 'react';
import './InterviewerDashboard.css';

const InterviewerDashboard = () => {
  const [candidateStream, setCandidateStream] = useState(null);
  const [status, setStatus] = useState('Connecting to candidate...');
  const [events, setEvents] = useState([]);
  const videoRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = new WebSocket('ws://localhost:4000/ws/interviewer');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to WebSocket server');
      setStatus('Connected to candidate');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'stream') {
        // Handle video stream
        const videoBlob = new Blob([data.chunk], { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(videoBlob);
        if (videoRef.current) {
          videoRef.current.src = videoUrl;
        }
      } else if (data.type === 'event') {
        // Handle detection events
        setEvents(prev => [
          { id: Date.now(), timestamp: new Date().toLocaleTimeString(), message: data.message },
          ...prev
        ].slice(0, 50));
      }
    };

    ws.onclose = () => {
      setStatus('Disconnected from candidate');
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="interviewer-dashboard">
      <header className="dashboard-header">
        <h1>Interviewer Dashboard</h1>
        <div className="status-indicator">
          <span className={`status-dot ${status === 'Connected to candidate' ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">{status}</span>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="video-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="candidate-video"
          />
          <div className="video-overlay">
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              <span>REC</span>
            </div>
          </div>
        </div>

        <div className="event-panel">
          <div className="panel-header">
            <h2>Activity Log</h2>
            <span className="event-count">{events.length} events</span>
          </div>
          <div className="event-log">
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
    </div>
  );
};

export default InterviewerDashboard;
