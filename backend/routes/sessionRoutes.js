const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const Event = require('../models/Event');

// Start a new session
router.post('/start', async (req, res) => {
  try {
    const { candidateName } = req.body;
    if (!candidateName) {
      return res.status(400).json({ error: 'Candidate name is required' });
    }

    const sessionId = uuidv4();
    const session = new Session({
      sessionId,
      candidateName,
      status: 'active'
    });

    await session.save();

    // Log session start event
    await Event.create({
      sessionId,
      type: 'session_start',
      details: { candidateName }
    });

    res.status(201).json({ 
      success: true, 
      sessionId,
      message: 'Session started successfully' 
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// End a session
router.post('/end', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await Session.findOneAndUpdate(
      { sessionId, status: 'active' },
      { 
        status: 'ended',
        endTime: new Date() 
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    // Log session end event
    await Event.create({
      sessionId,
      type: 'session_end',
      details: { duration: (new Date() - session.startTime) / 1000 }
    });

    res.json({ 
      success: true, 
      message: 'Session ended successfully' 
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Server error' });
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
