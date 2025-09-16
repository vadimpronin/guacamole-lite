const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GUACAMOLE_LITE_SERVER = process.env.GUACAMOLE_LITE_SERVER || 'http://guacamole-lite-server:3001';

app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get session data from guacamole-lite server
app.get('/api/sessions', async (req, res) => {
  try {
    const response = await axios.get(`${GUACAMOLE_LITE_SERVER}/api/sessions`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching sessions:', error.message);
    res.status(500).json({
      error: 'Failed to fetch session data',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const response = await axios.get(`${GUACAMOLE_LITE_SERVER}/api/health`);
    res.json(response.data);
  } catch (error) {
    console.error('Error checking health:', error.message);
    res.status(500).json({
      error: 'Failed to check server health',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Admin Dashboard running on port ${PORT}`);
  console.log(`Connecting to GuacamoleLite server at: ${GUACAMOLE_LITE_SERVER}`);
});
