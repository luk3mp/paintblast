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

// Event listeners (used by mock socket only)
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

// Reconnection tracking
let reconnectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 15;
let reconnectionTimer = null;

// Session tracking for reconnection — allows re-joining after disconnect
let playerSession = {
  name: null,
  team: null,
  joined: false,
};

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
 * Store join data so we can re-join on reconnect
 */
export const setPlayerSession = (name, team) => {
  playerSession.name = name;
  playerSession.team = team;
  playerSession.joined = true;
};

/**
 * Clear player session (on intentional disconnect)
 */
export const clearPlayerSession = () => {
  playerSession = { name: null, team: null, joined: false };
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
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ["websocket", "polling"],
      autoConnect: true,
      forceNew: false,
      multiplex: true,
    };

    // Add compression if enabled
    if (COMPRESSION_ENABLED) {
      socketOptions.perMessageDeflate = {
        threshold: 1024,
        zlibDeflateOptions: {
          level: 6,
          memLevel: 7,
        },
      };
    }

    socket = io(targetUrl, socketOptions);

    // ----- Connection event handlers -----

    socket.on("connect", () => {
      console.log(`✅ Connected to server: ${targetUrl} (sid: ${socket.id})`);
      connectionState = "connected";

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

      // If we have a saved session, re-join automatically
      if (playerSession.joined && playerSession.name) {
        console.log(
          `🔄 Re-joining as ${playerSession.name} (team: ${playerSession.team})`
        );
        socket.emit("join", {
          name: playerSession.name,
          team: playerSession.team,
        });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Disconnected from server (${targetUrl}): ${reason}`);
      connectionState = "disconnected";
      serverStatus.online = false;

      // Emit events
      emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });
      emitEvent(EVENTS.SERVER_STATUS_CHANGE, false);

      // Socket.IO handles reconnection automatically when `reconnection: true`
      // We only need manual reconnection for server-initiated disconnects
      if (reason === "io server disconnect" && isMultiplayerMode) {
        // Server explicitly disconnected us — try to reconnect manually
        reconnectionAttempts++;

        const backoffDelay = Math.min(
          Math.pow(2, reconnectionAttempts - 1) * 1000,
          30000
        );

        if (reconnectionAttempts <= MAX_RECONNECTION_ATTEMPTS) {
          console.log(
            `🔄 Server disconnected us. Reconnection attempt ${reconnectionAttempts}/${MAX_RECONNECTION_ATTEMPTS} in ${
              backoffDelay / 1000
            }s`
          );

          reconnectionTimer = setTimeout(() => {
            if (socket && !socket.connected && isMultiplayerMode) {
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
          emitEvent(EVENTS.CONNECTION_ERROR, {
            type: "max_reconnects",
            message:
              "Maximum reconnection attempts reached. Please refresh the page.",
          });
        }
      }
      // For "transport close" / "transport error" / "ping timeout",
      // Socket.IO's built-in reconnection handles it automatically.
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
    });

    // ----- Queue event handlers -----

    socket.on("queueUpdate", (data) => {
      console.log(`Queue position update: ${data.position}`);
      queuePosition = data.position;

      if (data.position === 0) {
        console.log("👍 Your turn to join the game!");
        connectionState = "connected";
        emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });
        emitEvent(EVENTS.QUEUE_READY, {});
      } else {
        connectionState = "queued";
        emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });
        emitEvent(EVENTS.QUEUE_UPDATE, {
          position: data.position,
          estimatedWaitTime: data.estimatedWaitTime || null,
        });
      }
    });

    // ----- Server status event handler -----

    socket.on("serverStatus", (status) => {
      const now = Date.now();

      // Mark server as online
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

    // ----- Game event handlers (relay to DOM event system) -----

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

    // ----- Players data handler -----
    // This is the SINGLE handler for players data.
    // Game.js should NOT add its own "players" listener — it should use
    // the EVENTS.PLAYERS_UPDATE DOM event instead.
    socket.on("players", (playersData) => {
      // Track data for performance monitoring
      const dataSize = JSON.stringify(playersData).length;
      trackNetworkTraffic(dataSize, "received");

      // Emit to DOM event system for React components
      emitEvent(EVENTS.PLAYERS_UPDATE, playersData);
    });

    // ----- Periodic status request -----
    if (multiplayer) {
      const statusInterval = setInterval(() => {
        if (socket && socket.connected) {
          socket.emit("requestServerStatus");
        }
      }, SERVER_STATUS_REFRESH_RATE);

      // Clean up interval on disconnect
      socket.on("disconnect", () => {
        clearInterval(statusInterval);
      });
    }

    // ----- Batch update processing -----
    if (BATCH_UPDATES) {
      setInterval(processBatchedUpdates, BATCH_UPDATE_INTERVAL);
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
      const dataSize = JSON.stringify(updateData).length;
      trackNetworkTraffic(dataSize, "sent");
      socket.emit("updatePosition", updateData);
      batchedUpdates.lastUpdateTime = now;
    }
  }
}

/**
 * Check if position changed significantly enough to send an update
 */
function positionChangedSignificantly(newPos, prevPos) {
  if (!prevPos) return true;

  const dx = newPos[0] - prevPos[0];
  const dy = newPos[1] - prevPos[1];
  const dz = newPos[2] - prevPos[2];

  const distanceSquared = dx * dx + dy * dy + dz * dz;
  return (
    distanceSquared > POSITION_UPDATE_THRESHOLD * POSITION_UPDATE_THRESHOLD
  );
}

/**
 * Check if rotation changed significantly enough to send an update
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
 */
export const getSocket = () => socket;

/**
 * Check if socket is connected (or in queue)
 */
export const isConnected = () =>
  connectionState === "connected" || connectionState === "queued";

/**
 * Get the current connection state
 */
export const getConnectionState = () => connectionState;

/**
 * Get the current queue position (0 if not in queue)
 */
export const getQueuePosition = () => queuePosition;

/**
 * Get the current server status
 */
export const getServerStatus = () => serverStatus;

/**
 * Check if running in multiplayer mode
 */
export const isMultiplayer = () => isMultiplayerMode;

/**
 * Disconnect socket (intentional)
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

    // Clear session so we don't auto-rejoin
    clearPlayerSession();

    console.log("Socket disconnected");
  }
};

/**
 * Send a player position update with optimization
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

        if (Object.keys(updateData).length > 0) {
          const dataSize = JSON.stringify(updateData).length;
          trackNetworkTraffic(dataSize, "sent");
          socket.emit("updatePosition", updateData);
        }
      }, POSITION_UPDATE_INTERVAL);
    }

    sendPositionUpdate.throttled(position, rotation);
  }
};

/**
 * Register a mock emit handler for single-player mode
 */
export const registerMockEmitHandler = (event, handler) => {
  mockEmitHandlers[event] = handler;
};

/**
 * Create a mock socket for single-player mode
 */
function createMockSocket() {
  return {
    emit: (event, data, callback) => {
      if (DEBUG_MODE) {
        console.log(`🔄 [MOCK SOCKET] Emit: ${event}`, data);
      }

      if (mockEmitHandlers[event]) {
        mockEmitHandlers[event](data, callback);
      }

      if (event === "message" && listeners["message"]) {
        setTimeout(() => {
          listeners["message"].forEach((listener) => {
            listener(data);
          });
        }, 50);
      }

      if (event === "requestServerStatus") {
        setTimeout(() => {
          const mockStatus = {
            currentPlayers: 1,
            maxPlayers: MAX_PLAYERS,
            queueLength: 0,
            hasSpace: true,
            redTeamPlayers: 1,
            blueTeamPlayers: 0,
          };
          serverStatus = mockStatus;
          emitEvent(EVENTS.SERVER_STATUS_UPDATE, serverStatus);
        }, 100);
      }

      if (event === "updatePosition" || event === "shoot") {
        trackNetworkTraffic(JSON.stringify(data).length, "sent");
      }
    },

    on: (event, callback) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    },

    off: (event, callback) => {
      if (listeners[event]) {
        if (callback) {
          listeners[event] = listeners[event].filter((cb) => cb !== callback);
        } else {
          listeners[event] = [];
        }
      }
    },

    connected: true,
    id: "single-player",

    disconnect: () => {
      console.log("Mock socket disconnected");
    },
  };
}

/**
 * Trigger a mock event (for testing or simulating server events in single-player)
 */
export const triggerMockEvent = (event, data) => {
  if (!listeners[event]) return;

  trackNetworkTraffic(JSON.stringify(data).length, "received");

  listeners[event].forEach((callback) => {
    callback(data);
  });
};

// Register default mock emit handlers for single-player mode
registerMockEmitHandler("join", (data) => {
  console.log("Mock server: Player joined", data);

  setTimeout(() => {
    triggerMockEvent("players", { "single-player": data });

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

  setTimeout(() => {
    triggerMockEvent("players", {
      [botId]: bot,
      "single-player": listeners["players"]
        ? Object.values(listeners["players"])[0]
        : { name: "Player", team, position: [0, 2, 0] },
    });
  }, 200);

  return bot;
};

/**
 * Get estimated wait time based on queue position
 */
export const getEstimatedWaitTime = (position) => {
  if (position <= 0) return "Ready to join";

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
 */
export const isServerOnline = () => {
  if (!socket) return false;

  const connectedStatus = socket.connected === true;
  const hasRecentStatus =
    serverStatus.online === true &&
    serverStatus.lastUpdate &&
    Date.now() - serverStatus.lastUpdate < 30000;

  return connectedStatus && hasRecentStatus;
};
