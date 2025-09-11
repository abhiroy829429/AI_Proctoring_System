const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  candidateName: {
    type: String,
    required: true
  },
  examId: {
    type: String,
    default: 'default-exam'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'terminated', 'error'],
    default: 'active'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  events: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  duration: {
    type: Number, // in seconds
    default: 0
  }
});

module.exports = mongoose.model('Session', SessionSchema);
