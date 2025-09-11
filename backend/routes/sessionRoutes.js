const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const Event = require('../models/Event');

// Enable CORS for all routes in this router
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// Start a new session
router.post('/', async (req, res) => {
  try {
    const { candidateName, examId, metadata } = req.body;
    console.log('Starting session with data:', { candidateName, examId, metadata });
    
    if (!candidateName) {
      console.error('Missing candidate name');
      return res.status(400).json({ 
        success: false,
        error: 'Candidate name is required' 
      });
    }

    const sessionId = uuidv4();
    const session = new Session({
      sessionId,
      candidateName,
      examId: examId || 'default-exam',
      status: 'active',
      startTime: new Date(),
      metadata: metadata || {}
    });

    try {
      await session.save();
      console.log('Session created:', sessionId);
    } catch (error) {
      console.error('Error saving session:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to create session' 
      });
    }

    // Log session start event
    try {
      await Event.create({
        sessionId,
        type: 'session_start',
        details: { 
          candidateName,
          examId: examId || 'default-exam',
          ...metadata
        }
      });
      console.log('Session start event logged');
    } catch (error) {
      console.error('Error logging session start event:', error);
      // Don't fail the request if event logging fails
    }

    console.log('Session started successfully:', sessionId);
    return res.status(201).json({ 
      success: true, 
      sessionId,
      message: 'Session started successfully' 
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// End a session
router.post('/end', async (req, res) => {
  try {
    const { sessionId, endReason, metadata } = req.body;
    console.log('Ending session with data:', { sessionId, endReason, metadata });
    
    if (!sessionId) {
      console.error('Missing session ID');
      return res.status(400).json({ 
        success: false,
        error: 'Session ID is required' 
      });
    }

    const updateData = {
      status: 'completed',
      endTime: new Date(),
      'metadata.endReason': endReason || 'user_ended',
      'metadata.endData': metadata || {}
    };

    const session = await Session.findOneAndUpdate(
      { sessionId },
      updateData,
      { new: true, upsert: false }
    );

    if (!session) {
      console.error('Session not found:', sessionId);
      return res.status(404).json({ 
        success: false,
        error: 'Session not found' 
      });
    }

    // Log session end event
    try {
      await Event.create({
        sessionId,
        type: 'session_end',
        details: {
          status: 'completed',
          endReason: endReason || 'user_ended',
          ...(metadata || {})
        }
      });
      console.log('Session end event logged for session:', sessionId);
    } catch (error) {
      console.error('Error logging session end event:', error);
      // Don't fail the request if event logging fails
    }

    console.log('Session ended successfully:', sessionId);
    res.json({ 
      success: true, 
      message: 'Session ended successfully',
      sessionId
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get session details
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const events = await Event.find({ sessionId }).sort({ timestamp: -1 });
    
    res.json({
      session,
      events
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
