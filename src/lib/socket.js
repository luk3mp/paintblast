/**
 * Socket.IO connection management for PaintBlast
 * Handles multiplayer functionality and provides a mock interface for single-player
 */

import { io } from "socket.io-client";
import {
  SERVER_URL as DEFAULT_SERVER_URL,
  DEBUG_MODE,
  MAX_PLAYERS,
  QUEUE_REFRESH_INTERVAL,
  SERVER_STATUS_REFRESH_RATE,
  POSITION_UPDATE_INTERVAL,
  POSITION_UPDATE_THRESHOLD,
  ROTATION_UPDATE_THRESHOLD,
  BATCH_UPDATES,
  BATCH_UPDATE_INTERVAL,
  COMPRESSION_ENABLED,
} from "./config";
import { EVENTS, emitEvent } from "./events";
import { trackNetworkTraffic } from "./performance";

// Socket instance
let socket = null;
let isMultiplayerMode = false;
let connectionState = "disconnected"; // disconnected, connecting, connected, queued
let queuePosition = 0;
let serverStatus = {
  currentPlayers: 0,
  maxPlayers: MAX_PLAYERS,
  queueLength: 0,
  hasSpace: true,
  online: false,
};

// Event listeners
const listeners = {};
const mockEmitHandlers = {};

// Position update batching
let batchedUpdates = {
  position: null,
  rotation: null,
  lastSentPosition: null,
  lastSentRotation: null,
  lastUpdateTime: 0,
};

// Last time we received player data
let lastPlayerDataTimestamp = 0;

// Reconnection tracking
let reconnectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 15;
let reconnectionTimer = null;

// Create a throttle function to limit update frequency
const throttle = (func, delay) => {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func(...args);
    }
  };
};

/**
 * Connect to the Socket.IO server or initialize mock socket for single-player
 * @param {Object} options Connection options
 * @param {boolean} options.multiplayer Whether to use multiplayer mode
 * @param {string} options.url Server URL (optional override, mainly for testing)
 * @returns {Object} The socket instance or mock socket for single-player
 */
export const connectSocket = ({ multiplayer = false, url = null }) => {
  // Return existing socket if already connected
  if (socket && socket.connected) {
    return socket;
  }

  // Disconnect existing socket if not connected properly
  if (socket && !socket.connected) {
    disconnectSocket();
  }

  isMultiplayerMode = multiplayer;

  if (!multiplayer) {
    // Single-player mode - create a mock socket
    console.log("🎮 Running in single-player mode (no server connection)");
    connectionState = "connected";

    // Emit connection state change event
    emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });

    // Create a mock socket for single-player mode
    socket = createMockSocket();

    return socket;
  }

  // Reset reconnection attempts when starting a new connection
  reconnectionAttempts = 0;

  // Clear any existing reconnection timer
  if (reconnectionTimer) {
    clearTimeout(reconnectionTimer);
    reconnectionTimer = null;
  }

  // Determine the actual URL to connect to
  // Priority: function param -> environment variable -> config -> localhost fallback
  const targetUrl =
    url ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    DEFAULT_SERVER_URL ||
    "http://localhost:5000";

  // Multiplayer mode - connect to Socket.IO server
  console.log(`🌐 Connecting to multiplayer server: ${targetUrl}`);
  connectionState = "connecting";

  // Reset server status
  serverStatus = {
    currentPlayers: 0,
    maxPlayers: MAX_PLAYERS,
    queueLength: 0,
    hasSpace: true,
    online: false,
  };

  // Emit connection state change event
  emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });
  emitEvent(EVENTS.SERVER_STATUS_CHANGE, false);

  try {
    const socketOptions = {
      reconnectionAttempts: 10, // Increased from 5 to 10
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000, // Add max delay
      timeout: 20000, // Increased from 10000
      transports: ["websocket", "polling"], // Add polling as fallback
      autoConnect: true,
      forceNew: false, // Allow reusing connections
      multiplex: true, // Enable connection multiplexing
    };

    // Add compression if enabled
    if (COMPRESSION_ENABLED) {
      socketOptions.perMessageDeflate = {
        threshold: 1024, // Only compress messages larger than 1KB
        zlibDeflateOptions: {
          level: 6, // Compression level (0-9), higher = more compression but slower
          memLevel: 7, // Memory level (1-9), higher = more memory used but faster
        },
      };
    }

    socket = io(targetUrl, socketOptions);

    // Set up ping-pong heartbeat to detect connection issues
    let lastPong = Date.now();
    let lastPlayerUpdate = Date.now();

    const heartbeat = setInterval(() => {
      // Check if we haven't received a player update in a while (30 seconds)
      const playerUpdateTimeout = Date.now() - lastPlayerUpdate > 30000;

      // If we haven't received a pong in 30 seconds, assume connection is lost
      if (
        (Date.now() - lastPong > 30000 || playerUpdateTimeout) &&
        connectionState === "connected"
      ) {
        console.log(
          "❌ Server heartbeat missed or no player updates, reconnecting..."
        );
        connectionState = "connecting";
        emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });
        emitEvent(EVENTS.SERVER_STATUS_CHANGE, false);
        serverStatus.online = false;

        // Force a reconnection
        socket.disconnect();
        socket.connect();

        // Update the last player update time to avoid immediate retries
        lastPlayerUpdate = Date.now();
      }
    }, 10000);

    // Setup connection event handlers
    socket.on("connect", () => {
      console.log(`✅ Connected to server: ${targetUrl}`);
      connectionState = "connected";
      lastPong = Date.now(); // Reset pong timer on connect
      lastPlayerUpdate = Date.now(); // Reset player update timer

      // Reset batched updates
      resetBatchedUpdates();

      // Reset reconnection attempts on successful connection
      reconnectionAttempts = 0;

      // Clear any reconnection timer
      if (reconnectionTimer) {
        clearTimeout(reconnectionTimer);
        reconnectionTimer = null;
      }

      // Emit connection state change event
      emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });

      // Request server status immediately after connecting
      socket.emit("requestServerStatus");
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Disconnected from server (${targetUrl}): ${reason}`);
      connectionState = "disconnected";
      serverStatus.online = false;

      // Emit events
      emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });
      emitEvent(EVENTS.SERVER_STATUS_CHANGE, false);

      // If not closed intentionally, try to reconnect after delay
      if (
        (reason === "io server disconnect" ||
          reason === "transport close" ||
          reason === "transport error") &&
        isMultiplayerMode
      ) {
        // Increment reconnection attempts
        reconnectionAttempts++;

        // Calculate exponential backoff delay (1s, 2s, 4s, 8s, etc. up to 30s max)
        const backoffDelay = Math.min(
          Math.pow(2, reconnectionAttempts - 1) * 1000,
          30000
        );

        if (reconnectionAttempts <= MAX_RECONNECTION_ATTEMPTS) {
          console.log(
            `🔄 Reconnection attempt ${reconnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS} in ${
              backoffDelay / 1000
            }s`
          );

          reconnectionTimer = setTimeout(() => {
            if (socket && !socket.connected && isMultiplayerMode) {
              console.log(
                `🔄 Attempting to reconnect (attempt ${reconnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS})...`
              );
              try {
                socket.connect();
              } catch (e) {
                console.error("Error during reconnection attempt:", e);
              }
            }
          }, backoffDelay);
        } else {
          console.error(
            `❌ Max reconnection attempts reached (${MAX_RECONNECTION_ATTEMPTS})`
          );
          // Notify the user they'll need to refresh or try again
          emitEvent(EVENTS.CONNECTION_ERROR, {
            type: "max_reconnects",
            message:
              "Maximum reconnection attempts reached. Please refresh the page.",
          });
        }
      }
    });

    socket.on("connect_error", (error) => {
      console.error(
        `❌ Connection error to ${targetUrl}:`,
        error.message,
        error.data || ""
      );
      connectionState = "disconnected";
      serverStatus.online = false;

      // Emit events
      emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });
      emitEvent(EVENTS.SERVER_STATUS_CHANGE, false);

      // Increment reconnection attempts
      reconnectionAttempts++;
    });

    // Pong handler to update heartbeat
    socket.on("pong", () => {
      lastPong = Date.now();
    });

    // Setup queue event handlers
    socket.on("queueUpdate", (data) => {
      console.log(`Queue position update: ${data.position}`);
      queuePosition = data.position;

      if (data.position === 0) {
        console.log("👍 Your turn to join the game!");
        connectionState = "connected";

        // Emit connection state change event
        emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });

        // Notify listeners that player can now join
        emitEvent(EVENTS.QUEUE_READY, {});
      } else {
        connectionState = "queued";

        // Emit connection state change event
        emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });

        // Notify listeners of queue position update
        emitEvent(EVENTS.QUEUE_UPDATE, {
          position: data.position,
          estimatedWaitTime: data.estimatedWaitTime || null,
        });
      }
    });

    // Setup server status event handlers
    socket.on("serverStatus", (status) => {
      // Timestamp for this status update to handle out-of-order updates
      const now = Date.now();
      console.log("Server status update:", status);

      // Mark that we received a server status update
      serverStatus.online = true;
      serverStatus.lastUpdate = now;

      // Convert legacy format if needed
      if (status.current_players !== undefined) {
        serverStatus = {
          online: true,
          lastUpdate: now,
          currentPlayers: status.current_players,
          maxPlayers: status.max_players,
          queueLength: status.queue_length,
          hasSpace: status.has_space,
          redTeamPlayers: status.redTeamPlayers || 0,
          blueTeamPlayers: status.blueTeamPlayers || 0,
        };
      } else {
        // Maintain the online state
        serverStatus = {
          ...status,
          online: true,
          lastUpdate: now,
        };
      }

      // Notify listeners of server status changes
      emitEvent(EVENTS.SERVER_STATUS_CHANGE, true);
      emitEvent(EVENTS.SERVER_STATUS_UPDATE, serverStatus);
    });

    // Setup game event handlers
    socket.on("playerKilled", (data) => {
      emitEvent(EVENTS.PLAYER_KILLED, data);
    });

    socket.on("flagCaptured", (data) => {
      emitEvent(EVENTS.FLAG_CAPTURED, data);
    });

    socket.on("flagReturned", (data) => {
      emitEvent(EVENTS.FLAG_RETURNED, data);
    });

    socket.on("flagScored", (data) => {
      emitEvent(EVENTS.FLAG_SCORED, data);
    });

    socket.on("gameStart", (data) => {
      emitEvent(EVENTS.GAME_START, data);
    });

    socket.on("gameOver", (data) => {
      emitEvent(EVENTS.GAME_END, data);
    });

    // Track received data for performance monitoring
    socket.on("players", (playersData) => {
      // Update the last player update timestamp
      lastPlayerUpdate = Date.now();

      // Approximate size calculation of the data
      const dataSize = JSON.stringify(playersData).length;
      trackNetworkTraffic(dataSize, "received");

      // Log player data - add debugging
      const playerCount = Object.keys(playersData).length;
      console.log(
        `[socket.js] Received players data with ${playerCount} players.`
      );

      // Store any existing listeners we need to forward to
      const existingListeners = listeners["players"] || [];

      // Process the received data (filtered in Game component)
      // Keep the existing listeners calling approach
      if (existingListeners.length > 0) {
        existingListeners.forEach((listener) => {
          try {
            listener(playersData);
          } catch (e) {
            console.error("Error in player data listener:", e);
          }
        });
      }

      // Also trigger the event via the event system for components listening
      // This is a more reliable way to propagate the event to multiple components
      emitEvent(EVENTS.PLAYERS_UPDATE, playersData);
    });

    // Set up batch update processing if enabled
    if (BATCH_UPDATES) {
      setInterval(processBatchedUpdates, BATCH_UPDATE_INTERVAL);
    }

    // Set up a timer to regularly request server status updates
    if (multiplayer) {
      const statusInterval = setInterval(() => {
        if (socket && socket.connected) {
          socket.emit("requestServerStatus");
        } else if (isMultiplayerMode && connectionState !== "connecting") {
          // If we detect the socket is disconnected but we should be in multiplayer mode
          console.log(
            "Socket not connected in status interval, trying to reconnect"
          );
          connectionState = "connecting";
          serverStatus.online = false;
          emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });
          emitEvent(EVENTS.SERVER_STATUS_CHANGE, false);

          // Try to reconnect
          if (socket) {
            try {
              socket.connect();
            } catch (e) {
              console.error("Error during reconnection in status interval:", e);
            }
          }
        }
      }, SERVER_STATUS_REFRESH_RATE);

      // Clean up on disconnect
      socket.on("disconnect", () => {
        clearInterval(statusInterval);
        clearInterval(heartbeat);
      });
    }

    return socket;
  } catch (error) {
    console.error(
      `❌ Failed to initialize socket connection to ${targetUrl}:`,
      error
    );
    connectionState = "disconnected";
    serverStatus.online = false;
    emitEvent(EVENTS.SERVER_STATUS_CHANGE, false);

    // Emit a connection error event that the UI can respond to
    emitEvent(EVENTS.CONNECTION_ERROR, {
      type: "initialization",
      message: "Failed to connect to the server. Please try again later.",
    });

    return null;
  }
};

/**
 * Reset batched updates tracker
 */
function resetBatchedUpdates() {
  batchedUpdates = {
    position: null,
    rotation: null,
    lastSentPosition: null,
    lastSentRotation: null,
    lastUpdateTime: 0,
  };
}

/**
 * Process batched position/rotation updates
 */
function processBatchedUpdates() {
  if (!socket || !socket.connected || !BATCH_UPDATES) return;

  const now = Date.now();
  if (now - batchedUpdates.lastUpdateTime < BATCH_UPDATE_INTERVAL) return;

  if (batchedUpdates.position || batchedUpdates.rotation) {
    const updateData = {};

    // Only send position if it changed significantly
    if (
      batchedUpdates.position &&
      (!batchedUpdates.lastSentPosition ||
        positionChangedSignificantly(
          batchedUpdates.position,
          batchedUpdates.lastSentPosition
        ))
    ) {
      updateData.position = batchedUpdates.position;
      batchedUpdates.lastSentPosition = [...batchedUpdates.position];
    }

    // Only send rotation if it changed significantly
    if (
      batchedUpdates.rotation &&
      (!batchedUpdates.lastSentRotation ||
        rotationChangedSignificantly(
          batchedUpdates.rotation,
          batchedUpdates.lastSentRotation
        ))
    ) {
      updateData.rotation = batchedUpdates.rotation;
      batchedUpdates.lastSentRotation = [...batchedUpdates.rotation];
    }

    // Only emit if we have data to send
    if (Object.keys(updateData).length > 0) {
      // Track outgoing data size
      const dataSize = JSON.stringify(updateData).length;
      trackNetworkTraffic(dataSize, "sent");

      // Send the update
      socket.emit("updatePosition", updateData);
      batchedUpdates.lastUpdateTime = now;
    }
  }
}

/**
 * Check if position changed significantly enough to send an update
 * @param {Array} newPos - New position
 * @param {Array} prevPos - Previous position
 * @returns {boolean} - Whether the change is significant
 */
function positionChangedSignificantly(newPos, prevPos) {
  if (!prevPos) return true;

  const dx = newPos[0] - prevPos[0];
  const dy = newPos[1] - prevPos[1];
  const dz = newPos[2] - prevPos[2];

  // Calculate distance squared (faster than using Math.sqrt)
  const distanceSquared = dx * dx + dy * dy + dz * dz;

  return (
    distanceSquared > POSITION_UPDATE_THRESHOLD * POSITION_UPDATE_THRESHOLD
  );
}

/**
 * Check if rotation changed significantly enough to send an update
 * @param {Array} newRot - New rotation
 * @param {Array} prevRot - Previous rotation
 * @returns {boolean} - Whether the change is significant
 */
function rotationChangedSignificantly(newRot, prevRot) {
  if (!prevRot) return true;

  const dx = Math.abs(newRot[0] - prevRot[0]);
  const dy = Math.abs(newRot[1] - prevRot[1]);
  const dz = Math.abs(newRot[2] - prevRot[2]);

  return (
    dx > ROTATION_UPDATE_THRESHOLD ||
    dy > ROTATION_UPDATE_THRESHOLD ||
    dz > ROTATION_UPDATE_THRESHOLD
  );
}

/**
 * Get the current socket instance
 * @returns {Object} Socket instance or null if not connected
 */
export const getSocket = () => socket;

/**
 * Check if socket is connected (or in queue)
 * @returns {boolean} True if connected or in queue
 */
export const isConnected = () =>
  connectionState === "connected" || connectionState === "queued";

/**
 * Get the current connection state
 * @returns {string} Connection state: 'disconnected', 'connecting', 'connected', or 'queued'
 */
export const getConnectionState = () => connectionState;

/**
 * Get the current queue position (0 if not in queue)
 * @returns {number} Queue position
 */
export const getQueuePosition = () => queuePosition;

/**
 * Get the current server status
 * @returns {Object} Server status object
 */
export const getServerStatus = () => serverStatus;

/**
 * Check if running in multiplayer mode
 * @returns {boolean} True if in multiplayer mode
 */
export const isMultiplayer = () => isMultiplayerMode;

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  // Clear any reconnection timer
  if (reconnectionTimer) {
    clearTimeout(reconnectionTimer);
    reconnectionTimer = null;
  }

  if (socket) {
    if (isMultiplayerMode) {
      socket.disconnect();
    }
    socket = null;
    connectionState = "disconnected";
    queuePosition = 0;
    console.log("Socket disconnected");
  }
};

/**
 * Send a player position update with optimization
 * If batching is enabled, this will queue the update
 * @param {Array} position - Player position
 * @param {Array} rotation - Player rotation
 */
export const sendPositionUpdate = (position, rotation) => {
  if (!socket || !isMultiplayerMode) return;

  if (BATCH_UPDATES) {
    // Store latest values for the next batch
    batchedUpdates.position = position;
    batchedUpdates.rotation = rotation;
  } else {
    // Create throttled function for direct updates
    if (!sendPositionUpdate.throttled) {
      sendPositionUpdate.throttled = throttle((pos, rot) => {
        const updateData = {};

        // Only include what has changed significantly
        if (
          pos &&
          (!batchedUpdates.lastSentPosition ||
            positionChangedSignificantly(pos, batchedUpdates.lastSentPosition))
        ) {
          updateData.position = pos;
          batchedUpdates.lastSentPosition = [...pos];
        }

        if (
          rot &&
          (!batchedUpdates.lastSentRotation ||
            rotationChangedSignificantly(rot, batchedUpdates.lastSentRotation))
        ) {
          updateData.rotation = rot;
          batchedUpdates.lastSentRotation = [...rot];
        }

        // Only send if there are changes
        if (Object.keys(updateData).length > 0) {
          // Track outgoing data size
          const dataSize = JSON.stringify(updateData).length;
          trackNetworkTraffic(dataSize, "sent");

          socket.emit("updatePosition", updateData);
        }
      }, POSITION_UPDATE_INTERVAL);
    }

    // Call the throttled function
    sendPositionUpdate.throttled(position, rotation);
  }
};

/**
 * Register a mock emit handler for single-player mode
 * This allows simulating server responses in single-player
 *
 * @param {string} event Event name
 * @param {Function} handler Handler function
 */
export const registerMockEmitHandler = (event, handler) => {
  mockEmitHandlers[event] = handler;
};

/**
 * Create a mock socket for single-player mode
 * @returns {Object} Mock socket object
 */
function createMockSocket() {
  return {
    // Mock emit function that handles events locally
    emit: (event, data, callback) => {
      if (DEBUG_MODE) {
        console.log(`🔄 [MOCK SOCKET] Emit: ${event}`, data);
      }

      // Handle specific events in single-player mode
      if (mockEmitHandlers[event]) {
        mockEmitHandlers[event](data, callback);
      }

      // Special case for single-player mode: immediately trigger message events
      if (event === "message" && listeners["message"]) {
        setTimeout(() => {
          listeners["message"].forEach((listener) => {
            listener(data);
          });
        }, 50);
      }

      // Mock server status responses
      if (event === "requestServerStatus") {
        setTimeout(() => {
          const mockStatus = {
            currentPlayers: 1, // Just you in single player
            maxPlayers: MAX_PLAYERS,
            queueLength: 0,
            hasSpace: true,
            redTeamPlayers: 1,
            blueTeamPlayers: 0,
          };

          // Update local status
          serverStatus = mockStatus;

          // Notify listeners
          emitEvent(EVENTS.SERVER_STATUS_UPDATE, serverStatus);
        }, 100);
      }

      // Track mock data for consistency
      if (event === "updatePosition" || event === "shoot") {
        trackNetworkTraffic(JSON.stringify(data).length, "sent");
      }
    },

    // Mock on function to register event listeners
    on: (event, callback) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    },

    // Mock off function to remove event listeners
    off: (event, callback) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      }
    },

    // Mock connected property
    connected: true,

    // Mock id property
    id: "single-player",

    // Mock disconnect function
    disconnect: () => {
      console.log("Mock socket disconnected");
    },
  };
}

/**
 * Trigger a mock event (for testing or simulating server events in single-player)
 * @param {string} event Event name
 * @param {*} data Event data
 */
export const triggerMockEvent = (event, data) => {
  if (!listeners[event]) return;

  // Mock receiving data for consistency
  trackNetworkTraffic(JSON.stringify(data).length, "received");

  listeners[event].forEach((callback) => {
    callback(data);
  });
};

// Register default mock emit handlers for single-player mode
registerMockEmitHandler("join", (data) => {
  // Simulate successful join in single-player
  console.log("Mock server: Player joined", data);

  // Trigger a players update
  setTimeout(() => {
    triggerMockEvent("players", { "single-player": data });

    // Also simulate a joinSuccess event
    triggerMockEvent("joinSuccess", {
      id: "single-player",
      team: data.team || "red",
      name: data.name || "Player",
      totalPlayers: 1,
    });
  }, 100);
});

// Export a utility for creating enemy bots in single-player mode
export const createEnemyBot = ({
  name = "Bot",
  team = Math.random() > 0.5 ? "Red" : "Blue",
  position = [0, 2, 0],
}) => {
  const botId = `bot-${Date.now()}`;
  const bot = {
    id: botId,
    name,
    team,
    position,
    rotation: [0, 0, 0],
    health: 100,
    isBot: true,
  };

  // Add bot to simulated players list
  setTimeout(() => {
    triggerMockEvent("players", {
      [botId]: bot,
      // Keep the local player in the list
      "single-player": listeners["players"]
        ? Object.values(listeners["players"])[0]
        : { name: "Player", team, position: [0, 2, 0] },
    });
  }, 200);

  return bot;
};

/**
 * Get estimated wait time based on queue position
 * @param {number} position Queue position
 * @returns {string} Formatted wait time estimate
 */
export const getEstimatedWaitTime = (position) => {
  if (position <= 0) return "Ready to join";

  // Simple estimate: 30 seconds per queue position
  const seconds = position * 30;

  if (seconds < 60) {
    return `< 1 minute`;
  } else {
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
};

/**
 * Check if server is online (has sent status updates)
 * @returns {boolean} True if server is online
 */
export const isServerOnline = () => {
  // More comprehensive check with timestamp validation
  if (!socket) return false;

  // Socket must be connected and we must have received a status update recently (within last 30 seconds)
  const connectedStatus = socket.connected === true;
  const hasRecentStatus =
    serverStatus.online === true &&
    serverStatus.lastUpdate &&
    Date.now() - serverStatus.lastUpdate < 30000;

  return connectedStatus && hasRecentStatus;
};

/**
 * Update requirements.txt file to include the additional dependencies needed
 */
