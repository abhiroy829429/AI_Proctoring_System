const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      // Session events
      'session_start', 'session_end', 'session_pause', 'session_resume',
      // Face detection events
      'no_face', 'multiple_faces', 'face_detected', 'face_lost',
      // Object detection events
      'suspicious_object', 'forbidden_object',
      // System events
      'error', 'warning', 'info',
      // User action events
      'tab_switch', 'window_resize', 'copy_paste', 'print_screen',
      // Custom events
      'custom'
    ]
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  },
  source: {
    type: String,
    enum: ['system', 'face_detection', 'object_detection', 'user_action', 'api'],
    default: 'system'
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  screenshot: {
    type: String, // Base64 encoded image or URL
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

module.exports = mongoose.model('Event', EventSchema);
