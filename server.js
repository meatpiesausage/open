const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state - now tracking both active connections and persistent players
const players = {}; // username -> player data
const activeSockets = {}; // socketId -> username mapping
const socketToUsername = {}; // socketId -> username for quick lookup

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle player joining
  socket.on('playerJoin', (username) => {
    console.log(`Player ${username} attempting to join`);
    
    // Check if username is already taken by an active player
    const isUsernameActive = Object.values(activeSockets).includes(username);
    
    if (isUsernameActive) {
      socket.emit('joinError', 'Username is already taken by an active player');
      return;
    }
    
    // Store the socket-username mapping
    socketToUsername[socket.id] = username;
    activeSockets[socket.id] = username;
    
    // If player exists, they're returning
    if (players[username]) {
      console.log(`Player ${username} returned to existing character`);
      players[username].isActive = true;
      players[username].lastSeen = Date.now();
    } else {
      // New player - create character
      console.log(`New player ${username} joined`);
      players[username] = {
        username: username,
        x: Math.floor(Math.random() * 500),
        y: Math.floor(Math.random() * 500),
        isActive: true,
        createdAt: Date.now(),
        lastSeen: Date.now()
      };
    }
    
    // Send the current state to the new player
    socket.emit('gameState', players);
    
    // Broadcast to all other players that a player joined/returned
    socket.broadcast.emit('playerStatusChanged', {
      username: username,
      ...players[username],
      action: 'joined'
    });
  });

  // Handle movement
  socket.on('updatePosition', (position) => {
    const username = socketToUsername[socket.id];
    if (username && players[username] && players[username].isActive) {
      players[username].x = position.x;
      players[username].y = position.y;
      players[username].lastSeen = Date.now();
      
      // Broadcast the updated position to all players
      io.emit('playerMoved', {
        username: username,
        ...players[username]
      });
    }
  });

  // Handle chat messages
  socket.on('chatMessage', (message) => {
    const username = socketToUsername[socket.id];
    if (username && players[username] && players[username].isActive && message.trim()) {
      console.log(`Chat from ${username}: ${message}`);
      
      players[username].lastSeen = Date.now();
      
      // Broadcast the message to all players
      io.emit('chatMessage', {
        username: username,
        message: message.trim()
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const username = socketToUsername[socket.id];
    if (username && players[username]) {
      console.log(`Player ${username} went inactive (character remains)`);
      
      // Mark player as inactive but keep their character
      players[username].isActive = false;
      players[username].lastSeen = Date.now();
      
      // Clean up socket mappings
      delete activeSockets[socket.id];
      delete socketToUsername[socket.id];
      
      // Notify all clients that a player went inactive
      io.emit('playerStatusChanged', {
        username: username,
        ...players[username],
        action: 'left'
      });
    }
  });

  // Optional: Handle manual cleanup of old inactive players
  socket.on('cleanupOldPlayers', () => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    
    Object.keys(players).forEach(username => {
      if (!players[username].isActive && (now - players[username].lastSeen) > oneHour) {
        console.log(`Removing old inactive player: ${username}`);
        delete players[username];
        io.emit('playerRemoved', username);
      }
    });
  });
});

// Optional: Periodic cleanup of very old inactive players (runs every 30 minutes)
setInterval(() => {
  const now = Date.now();
  const sixHours = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
  
  Object.keys(players).forEach(username => {
    if (!players[username].isActive && (now - players[username].lastSeen) > sixHours) {
      console.log(`Auto-removing old inactive player: ${username}`);
      delete players[username];
      io.emit('playerRemoved', username);
    }
  });
}, 30 * 60 * 1000); // Run every 30 minutes

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});