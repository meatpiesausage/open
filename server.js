const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const players = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle player joining
  socket.on('playerJoin', (username) => {
    console.log(`Player ${username} joined`);
    
    // Initialize player with random coordinates
    players[socket.id] = {
      username: username,
      x: Math.floor(Math.random() * 500),
      y: Math.floor(Math.random() * 500)
    };
    
    // Send the current state to the new player
    socket.emit('gameState', players);
    
    // Broadcast to all other players that a new player joined
    socket.broadcast.emit('playerJoined', {
      id: socket.id,
      ...players[socket.id]
    });
  });

  // Handle movement
  socket.on('updatePosition', (position) => {
    if (players[socket.id]) {
      players[socket.id].x = position.x;
      players[socket.id].y = position.y;
      
      // Broadcast the updated position to all players
      io.emit('playerMoved', {
        id: socket.id,
        ...players[socket.id]
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (players[socket.id]) {
      const username = players[socket.id].username;
      console.log(`Player ${username} left`);
      
      // Remove player from game state
      delete players[socket.id];
      
      // Notify all clients that a player left
      io.emit('playerLeft', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});