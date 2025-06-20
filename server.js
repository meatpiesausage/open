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

// Door
let isDoorVisible = false;
let doorTimeout = null;

// Door interaction tracking
const doorInteractions = {}; // username -> interaction count
const doorInteractionCooldown = {}; // username -> last interaction time
const DOOR_COOLDOWN_MS = 1000; // 1 second cooldown

// Objects
// Solid objects that can't be moved
// Interactive Objects that the user interacts with
// Movable Objects that the user can pick up.
const objects = [] 

// Add this function to handle special door effects
function handleDoorEffect(username, effect, socket) {
    switch (effect) {
        case 'symbols':
            // Could reveal hidden information or give a clue
            socket.emit('chatMessage', {
                username: 'Door',
                message: '✨ Ancient symbols glow: "Persistence opens all doors" ✨'
            });
            break;
            
        case 'creak':
            // Play a sound effect or change the door appearance
            io.emit('doorEffect', { type: 'creak', username: username });
            break;
            
        case 'open':
            // Major effect - maybe teleport player, give reward, or start event
            const player = players[username];
            if (player) {
                // Example: Teleport to center of map
                player.x = Math.floor(Math.random() * 400) + 100;
                player.y = Math.floor(Math.random() * 300) + 100;
                
                io.emit('playerMoved', {
                    username: username,
                    ...player
                });
                
                socket.emit('chatMessage', {
                    username: 'Door',
                    message: '🌟 The door teleports you to a new location! 🌟'
                });
                
                // Maybe hide the door after it's been fully opened
                setTimeout(() => {
                    hideDoor();
                    resetDoorInteractions();
                }, 3000);
            }
            break;
            
        default:
            break;
    }
}

function checkForDoorKeyword(message) {
  const keywords = ['door', 'Door', 'DOOR'];
  return keywords.some(keyword => message.includes(keyword));
}

// Add this function to handle door interactions
function handleDoorInteraction(username, playerData) {
    const now = Date.now();
    
    // Check cooldown
    if (doorInteractionCooldown[username] && (now - doorInteractionCooldown[username]) < DOOR_COOLDOWN_MS) {
        return null; // Ignore rapid interactions
    }
    
    doorInteractionCooldown[username] = now;
    
    // Increment interaction count
    if (!doorInteractions[username]) {
        doorInteractions[username] = 0;
    }
    doorInteractions[username]++;
    
    console.log(`${username} interacted with the door (interaction #${doorInteractions[username]})`);
    
    // You can customize the door's behavior based on various factors
    const interactionCount = doorInteractions[username];
    let response = {
        username: username,
        message: `Touched the mysterious door...`,
        interactionCount: interactionCount,
        effect: null
    };
    
    // Example: Different effects based on interaction count
    switch (interactionCount) {
        case 1:
            response.message = "The door feels warm to the touch...";
            break;
        case 2:
            response.message = "The door begins to glow faintly...";
            break;
        case 3:
            response.message = "Strange symbols appear on the door!";
            response.effect = "symbols";
            break;
        case 5:
            response.message = "The door creaks open slightly...";
            response.effect = "creak";
            break;
        case 10:
            response.message = "The door swings open wide!";
            response.effect = "open";
            // Maybe teleport the player or give them a reward
            break;
        default:
            if (interactionCount > 10) {
                response.message = "The door remains mysteriously closed...";
            } else {
                response.message = `The door hums with energy... (${interactionCount}/10)`;
            }
            break;
    }
    
    return response;
}

// Add this function to reset door interactions (optional)
function resetDoorInteractions() {
    Object.keys(doorInteractions).forEach(username => {
        doorInteractions[username] = 0;
    });
    console.log('Door interactions reset for all players');
}


function showDoor() {
  if (!isDoorVisible) {
    isDoorVisible = true;
    io.emit('doorTriggered');
    console.log('Door triggered by keyword');

    // Auto-hide door after 30 seconds
    if (doorTimeout) {
      clearTimeout(doorTimeout);
    }

    doorTimeout = setTimeout(() => {
      hideDoor();
    }, 30000); // 30 seconds
  }
}

function hideDoor() {
  if (isDoorVisible) {
    isDoorVisible = false;
    io.emit('doorRemoved');
    console.log('Door hidden');

    // Reset door interactions when door disappears
    resetDoorInteractions();

    if (doorTimeout) {
      clearTimeout(doorTimeout);
      doorTimeout = null;
    }
  }
}

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

     // Send the current state to the new player
    socket.emit('gameState', players);
    
    // Sync door state for new player
    if (isDoorVisible) {
        socket.emit('doorTriggered');
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
        lastSeen: Date.now(),
        lastMessage: null, // Store the last message
        lastMessageTime: null, // Store when the last message was sent
        life: 4, // Each player has a life which has four parts.
      };
    }

    // Send the current state to the new player
    socket.emit('gameState', players);

    // Send last messages from all players who have messages
    Object.keys(players).forEach(playerUsername => {
      if (players[playerUsername].lastMessage) {
        socket.emit('chatMessage', {
          username: playerUsername,
          message: players[playerUsername].lastMessage,
          isHistorical: true // Flag to indicate this is a previous message
        });
      }
    });

    // Broadcast to all other players that a player joined/returned
    socket.broadcast.emit('playerStatusChanged', {
      username: username,
      ...players[username],
      action: 'joined'
    });
  });

  // Optional: Add command to manually reset door interactions (for debugging)
socket.on('resetDoorInteractions', () => {
    const username = socketToUsername[socket.id];
    if (username && players[username]) {
        resetDoorInteractions();
        io.emit('chatMessage', {
            username: 'System',
            message: 'Door interactions have been reset!'
        });
    }
});

  socket.on('doorInteraction', (data) => {
    const username = socketToUsername[socket.id];
    
    // Verify the player exists and is active
    if (!username || !players[username] || !players[username].isActive) {
        return;
    }
    
    // Verify the door is visible
    if (!isDoorVisible) {
        socket.emit('doorInteractionResult', {
            username: username,
            message: "There's no door here...",
            success: false
        });
        return;
    }
    
    // Handle the door interaction
    const result = handleDoorInteraction(username, data);
    
    if (result) {
        // Send response back to the player who interacted
        socket.emit('doorInteractionResult', result);
        
        // Broadcast to all players that someone interacted with the door
        io.emit('playerInteractedWithDoor', {
            username: username,
            x: data.x,
            y: data.y,
            interactionCount: result.interactionCount,
            message: result.message
        });
        
        // Update player's last seen time
        players[username].lastSeen = Date.now();
        
        // Special effects based on interaction results
        if (result.effect) {
            handleDoorEffect(username, result.effect, socket);
        }
    }
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
        
        const trimmedMessage = message.trim();
        players[username].lastSeen = Date.now();
        
        // Store the last message for this player
        players[username].lastMessage = trimmedMessage;
        players[username].lastMessageTime = Date.now();
        
        // Check for door keyword
        if (checkForDoorKeyword(trimmedMessage)) {
            showDoor();
        }
        
        // Broadcast the message to all players
        io.emit('chatMessage', {
            username: username,
            message: trimmedMessage
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

process.on('SIGINT', () => {
    console.log('Server shutting down...');
    if (doorTimeout) {
        clearTimeout(doorTimeout);
    }
    process.exit(0);
});