const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Log a new event
router.post('/', async (req, res) => {
  try {
    const { sessionId, type, detail, ts } = req.body;
    
    if (!sessionId || !type) {
      return res.status(400).json({ error: 'Session ID and event type are required' });
    }

    const event = await Event.create({
      sessionId,
      type,
      details: detail || {},
      timestamp: ts ? new Date(ts) : new Date()
    });

    res.status(201).json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error logging event:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get events for a session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const events = await Event.find({ sessionId })
      .sort({ timestamp: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit));

    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
