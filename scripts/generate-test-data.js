const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '../backend/.env.production' });

// Import models
const Session = require('../backend/models/Session');
const Event = require('../backend/models/Event');

// Sample data
const CANDIDATE_NAMES = [
  'Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince', 'Ethan Hunt',
  'Fiona Gallagher', 'George Washington', 'Hannah Montana', 'Ian Malcolm', 'Jane Doe'
];

const EXAM_IDS = ['MATH-101', 'PHYS-201', 'CS-301', 'ENG-102', 'HIST-202'];

const EVENT_TYPES = [
  'session_start', 'session_end', 'face_detected', 'face_lost', 'no_face',
  'multiple_faces', 'suspicious_object', 'tab_switch', 'window_resize', 'copy_paste'
];

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

// Generate a random date within a range
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate a random event
function generateEvent(sessionId, timestamp) {
  const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  const severity = ['info', 'warning', 'error'][Math.floor(Math.random() * 3)];
  
  const event = {
    sessionId,
    type,
    timestamp,
    severity,
    details: {},
    metadata: {
      source: 'test_data_generator',
      confidence: Math.random().toFixed(2)
    }
  };

  // Add type-specific details
  switch (type) {
    case 'no_face':
      event.details = { duration: Math.floor(Math.random() * 10) + 1 };
      break;
    case 'multiple_faces':
      event.details = { count: Math.floor(Math.random() * 3) + 2 };
      break;
    case 'suspicious_object':
      const objects = ['phone', 'book', 'tablet', 'calculator', 'headphones'];
      event.details = { 
        object: objects[Math.floor(Math.random() * objects.length)],
        confidence: (Math.random() * 0.5 + 0.5).toFixed(2)
      };
      break;
    case 'tab_switch':
    case 'window_resize':
      event.details = { 
        count: Math.floor(Math.random() * 5) + 1,
        duration: Math.floor(Math.random() * 30) + 1
      };
      break;
    case 'copy_paste':
      event.details = {
        contentLength: Math.floor(Math.random() * 100) + 10,
        source: Math.random() > 0.5 ? 'clipboard' : 'keyboard'
      };
      break;
  }

  return event;
}

// Generate test sessions with events
async function generateTestData(numSessions = 10, maxEventsPerSession = 50) {
  try {
    // Clear existing data
    await Promise.all([
      Session.deleteMany({}),
      Event.deleteMany({})
    ]);
    console.log('Cleared existing test data');

    const sessions = [];
    const events = [];
    const now = new Date();

    for (let i = 0; i < numSessions; i++) {
      const sessionId = uuidv4();
      const candidateName = CANDIDATE_NAMES[Math.floor(Math.random() * CANDIDATE_NAMES.length)];
      const examId = EXAM_IDS[Math.floor(Math.random() * EXAM_IDS.length)];
      const startTime = randomDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now);
      const duration = Math.floor(Math.random() * 60) + 30; // 30-90 minutes
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      
      const session = new Session({
        sessionId,
        candidateName,
        examId,
        startTime,
        endTime,
        status: 'completed',
        duration,
        metadata: {
          browser: 'Chrome',
          os: 'Windows 10',
          ip: `192.168.1.${Math.floor(Math.random() * 255) + 1}`
        }
      });

      // Generate session events
      const sessionEvents = [];
      const numEvents = Math.floor(Math.random() * (maxEventsPerSession - 5)) + 5; // 5 to maxEventsPerSession events per session
      
      // Add session start event
      sessionEvents.push({
        sessionId,
        type: 'session_start',
        timestamp: startTime,
        severity: 'info',
        details: {},
        metadata: { source: 'system' }
      });

      // Add random events during session
      for (let j = 0; j < numEvents - 2; j++) {
        const eventTime = randomDate(startTime, endTime);
        sessionEvents.push(generateEvent(sessionId, eventTime));
      }

      // Add session end event
      sessionEvents.push({
        sessionId,
        type: 'session_end',
        timestamp: endTime,
        severity: 'info',
        details: { status: 'completed', duration },
        metadata: { source: 'system' }
      });

      // Sort events by timestamp
      sessionEvents.sort((a, b) => a.timestamp - b.timestamp);
      
      // Add to events array
      events.push(...sessionEvents);
      sessions.push(session);

      console.log(`Generated session ${i + 1}/${numSessions} with ${sessionEvents.length} events`);
    }

    // Save sessions
    await Session.insertMany(sessions);
    console.log(`Saved ${sessions.length} sessions`);

    // Save events in batches
    const batchSize = 100;
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      await Event.insertMany(batch);
      console.log(`Saved events ${i + 1}-${Math.min(i + batchSize, events.length)}/${events.length}`);
    }

    console.log('Test data generation completed successfully!');
    
  } catch (error) {
    console.error('Error generating test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
  }
}

// Run the script
(async () => {
  try {
    await connectDB();
    await generateTestData(20, 100); // Generate 20 sessions with up to 100 events each
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
})();
