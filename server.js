const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const geoip = require('geoip-lite');
const axios = require('axios');

let activeUsers = 0;

// Add this function to get public IP
async function getPublicIP() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Error fetching public IP:', error);
    return null;
  }
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', async (socket) => {
  activeUsers++;
  
  // Get real public IP
  let clientIP = await getPublicIP();
  
  if (!clientIP) {
    clientIP = '8.8.8.8'; // Fallback IP if public IP detection fails
  }

  // Get location info with retries
  let geo = geoip.lookup(clientIP);
  if (!geo) {
    // Try alternative IPs if first lookup fails
    const alternativeIPs = ['8.8.8.8', '1.1.1.1'];
    for (let ip of alternativeIPs) {
      geo = geoip.lookup(ip);
      if (geo) {
        clientIP = ip;
        break;
      }
    }
  }

  const locationInfo = geo ? {
    country: geo.country,
    city: geo.city || 'Unknown City',
    region: geo.region || 'Unknown Region',
    timezone: geo.timezone || 'Unknown Timezone'
  } : { 
    country: 'Bangladesh', // Default fallback
    city: 'Dhaka',
    region: 'Dhaka Division',
    timezone: 'Asia/Dhaka'
  };
  
  console.log('New connection from:', {
    ip: clientIP,
    location: locationInfo
  });
  
  // Broadcast active users count and connection info to all clients
  io.emit('active users', {
    count: activeUsers,
    location: locationInfo,
    ip: clientIP
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    activeUsers--;
    io.emit('active users', {
      count: activeUsers,
      location: locationInfo,
      ip: clientIP
    });
  });
});

http.listen(3001, () => {
  console.log('Server running at http://localhost:3001');
});
