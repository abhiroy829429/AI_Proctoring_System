const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Session = require('../models/Session');

// Log a new event
router.post('/', async (req, res) => {
  try {
    const { sessionId, type, details, timestamp, severity = 'info', source = 'frontend', metadata = {} } = req.body;
    
    // Input validation
    if (!sessionId || !type) {
      console.error('Missing required fields:', { sessionId, type });
      return res.status(400).json({ 
        success: false,
        error: 'Session ID and event type are required' 
      });
    }

    // Verify session exists
    const session = await Session.findOne({ sessionId });
    if (!session) {
      console.error('Session not found:', sessionId);
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }

    // Create the event
    const event = await Event.create({
      sessionId,
      type,
      details: details || {},
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      severity,
      source,
      metadata: {
        ...metadata,
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    // Update session with the new event reference
    await Session.findByIdAndUpdate(
      session._id,
      { 
        $push: { events: event._id },
        $set: { lastActivity: new Date() }
      },
      { new: true }
    );

    console.log(`Event logged: ${type} for session ${sessionId}`);
    
    res.status(201).json({
      success: true,
      eventId: event._id,
      timestamp: event.timestamp
    });

  } catch (error) {
    console.error('Error logging event:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to log event',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Log multiple events in a batch
router.post('/batch', async (req, res) => {
  try {
    const { sessionId, events = [] } = req.body;
    
    if (!sessionId || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session ID and events array are required' 
      });
    }

    // Verify session exists
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }

    // Prepare events with timestamps
    const eventsWithTimestamps = events.map(event => ({
      ...event,
      sessionId,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      source: event.source || 'frontend',
      severity: event.severity || 'info',
      details: event.details || {},
      metadata: {
        ...(event.metadata || {}),
        ip: req.ip,
        userAgent: req.get('user-agent'),
        batch: true
      }
    }));

    // Insert all events
    const createdEvents = await Event.insertMany(eventsWithTimestamps);
    const eventIds = createdEvents.map(e => e._id);

    // Update session with new events
    await Session.findByIdAndUpdate(
      session._id,
      { 
        $push: { events: { $each: eventIds } },
        $set: { lastActivity: new Date() }
      },
      { new: true }
    );

    console.log(`Logged ${eventIds.length} events for session ${sessionId}`);
    
    res.status(201).json({
      success: true,
      count: createdEvents.length,
      eventIds
    });

  } catch (error) {
    console.error('Error batch logging events:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to log events',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get events for a session with filtering
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { 
      limit = 100, 
      offset = 0, 
      type, 
      severity, 
      startDate, 
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { sessionId };
    
    // Apply filters
    if (type) {
      if (Array.isArray(type)) {
        query.type = { $in: type };
      } else {
        query.type = type;
      }
    }
    
    if (severity) {
      if (Array.isArray(severity)) {
        query.severity = { $in: severity };
      } else {
        query.severity = severity;
      }
    }
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const [events, total] = await Promise.all([
      Event.find(query)
        .sort(sort)
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .lean(),
      Event.countDocuments(query)
    ]);

    res.json({
      success: true,
      count: events.length,
      total,
      hasMore: (parseInt(offset) + events.length) < total,
      events
    });
    
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch events',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
