/**
 * Socket.IO connection management for PaintBlast
 * Handles multiplayer functionality and provides a mock interface for single-player
 */

import { io } from "socket.io-client";
import {
  SERVER_URL,
  DEBUG_MODE,
  MAX_PLAYERS,
  QUEUE_REFRESH_INTERVAL,
  SERVER_STATUS_REFRESH_RATE,
} from "./config";
import { EVENTS, emitEvent } from "./events";

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
};

// Event listeners
const listeners = {};
const mockEmitHandlers = {};

/**
 * Connect to the Socket.IO server or initialize mock socket for single-player
 * @param {Object} options Connection options
 * @param {boolean} options.multiplayer Whether to use multiplayer mode
 * @param {string} options.url Server URL (defaults to config.SERVER_URL)
 * @returns {Object} The socket instance or mock socket for single-player
 */
export const connectSocket = ({ multiplayer = false, url = SERVER_URL }) => {
  // Return existing socket if already connected
  if (socket) {
    return socket;
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

  // Multiplayer mode - connect to Socket.IO server
  console.log(`🌐 Connecting to multiplayer server: ${url}`);
  connectionState = "connecting";

  // Emit connection state change event
  emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });

  try {
    socket = io(url, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    // Setup connection event handlers
    socket.on("connect", () => {
      console.log("✅ Connected to server");
      connectionState = "connected";

      // Emit connection state change event
      emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });

      // Request server status immediately after connecting
      socket.emit("requestServerStatus");
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Disconnected from server: ${reason}`);
      connectionState = "disconnected";

      // Emit connection state change event
      emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });
    });

    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      connectionState = "disconnected";

      // Emit connection state change event
      emitEvent(EVENTS.CONNECTION_STATE_CHANGE, { state: connectionState });
    });

    // Setup queue event handlers
    socket.on("queuePosition", (data) => {
      console.log(`Queue position update: ${data.position}`);
      queuePosition = data.position;

      if (data.canJoin) {
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
      console.log("Server status update:", status);
      serverStatus = {
        currentPlayers: status.current_players,
        maxPlayers: status.max_players,
        queueLength: status.queue_length,
        hasSpace: status.has_space,
      };

      // Notify listeners of server status update
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

    // Set up a timer to regularly request server status updates
    if (multiplayer) {
      setInterval(() => {
        if (socket && socket.connected) {
          socket.emit("requestServerStatus");
        }
      }, SERVER_STATUS_REFRESH_RATE);
    }

    return socket;
  } catch (error) {
    console.error("Failed to initialize socket:", error);
    connectionState = "disconnected";
    return null;
  }
};

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
            current_players: 1, // Just you in single player
            max_players: MAX_PLAYERS,
            queue_length: 0,
            has_space: true,
          };

          // Update local status
          serverStatus = {
            currentPlayers: mockStatus.current_players,
            maxPlayers: mockStatus.max_players,
            queueLength: mockStatus.queue_length,
            hasSpace: mockStatus.has_space,
          };

          // Notify listeners
          triggerMockEvent("serverStatusUpdate", serverStatus);
        }, 100);
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
 * Update requirements.txt file to include the additional dependencies needed
 */
