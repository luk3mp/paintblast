/**
 * Performance monitoring and optimization utilities for PaintBlast
 * Helps manage game performance with high player counts
 */

import {
  DEFAULT_PERFORMANCE_LEVEL,
  FPS_THRESHOLDS,
  DYNAMIC_QUALITY_ADJUSTMENT,
  MAX_RENDERED_PLAYERS,
  PLAYER_RENDER_DISTANCE,
  LOW_DETAIL_DISTANCE,
} from "./config";

// Performance monitor state
let performanceLevel = DEFAULT_PERFORMANCE_LEVEL;
let fpsHistory = [];
let lastFrameTime = 0;
let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 60;
let networkStats = {
  bytesSent: 0,
  bytesReceived: 0,
  messagesSent: 0,
  messagesReceived: 0,
  lastResetTime: Date.now(),
};

// Performance settings for each level
export const PERFORMANCE_SETTINGS = {
  low: {
    maxPaintballs: 20,
    maxSplats: 30,
    maxParticles: 50,
    particleLifetime: 500,
    shadowQuality: "off",
    antialiasing: false,
    maxVisiblePlayers: 10,
    renderDistance: PLAYER_RENDER_DISTANCE * 0.5,
    billboardDistance: LOW_DETAIL_DISTANCE * 0.5,
    useSimplifiedPhysics: true,
    disableNonEssentialEffects: true,
  },
  medium: {
    maxPaintballs: 40,
    maxSplats: 60,
    maxParticles: 100,
    particleLifetime: 1000,
    shadowQuality: "low",
    antialiasing: true,
    maxVisiblePlayers: 15,
    renderDistance: PLAYER_RENDER_DISTANCE * 0.75,
    billboardDistance: LOW_DETAIL_DISTANCE * 0.75,
    useSimplifiedPhysics: false,
    disableNonEssentialEffects: false,
  },
  high: {
    maxPaintballs: 80,
    maxSplats: 120,
    maxParticles: 200,
    particleLifetime: 2000,
    shadowQuality: "high",
    antialiasing: true,
    maxVisiblePlayers: MAX_RENDERED_PLAYERS,
    renderDistance: PLAYER_RENDER_DISTANCE,
    billboardDistance: LOW_DETAIL_DISTANCE,
    useSimplifiedPhysics: false,
    disableNonEssentialEffects: false,
  },
};

// Quality values for various aspects of the game
export const QUALITY_VALUES = {
  shadow: {
    off: { enabled: false, mapSize: 0 },
    low: { enabled: true, mapSize: 1024 },
    medium: { enabled: true, mapSize: 2048 },
    high: { enabled: true, mapSize: 4096 },
  },
  physics: {
    low: {
      maxPaintballsPerSecond: 5,
      simplifiedCollision: true,
    },
    medium: {
      maxPaintballsPerSecond: 8,
      simplifiedCollision: false,
    },
    high: {
      maxPaintballsPerSecond: 12,
      simplifiedCollision: false,
    },
  },
};

/**
 * Initialize the performance monitor
 */
export const initPerformanceMonitor = () => {
  lastFrameTime = performance.now();
  lastFpsUpdate = lastFrameTime;
  frameCount = 0;
  fpsHistory = [];
};

/**
 * Update the FPS counter
 * Call this every frame
 */
export const updateFps = () => {
  const now = performance.now();
  frameCount++;

  // Update FPS every 500ms
  if (now - lastFpsUpdate > 500) {
    currentFps = (frameCount * 1000) / (now - lastFpsUpdate);
    fpsHistory.push(currentFps);

    // Keep history limited to 10 samples
    if (fpsHistory.length > 10) {
      fpsHistory.shift();
    }

    frameCount = 0;
    lastFpsUpdate = now;

    // Adjust quality if dynamic adjustment is enabled
    if (DYNAMIC_QUALITY_ADJUSTMENT) {
      const avgFps = getAverageFPS();

      if (avgFps < FPS_THRESHOLDS.low && performanceLevel !== "low") {
        setPerformanceLevel("low");
      } else if (
        avgFps < FPS_THRESHOLDS.medium &&
        performanceLevel === "high"
      ) {
        setPerformanceLevel("medium");
      } else if (avgFps > FPS_THRESHOLDS.high && performanceLevel !== "high") {
        setPerformanceLevel("high");
      }
    }
  }

  lastFrameTime = now;
};

/**
 * Get the current FPS
 * @returns {number} Current frames per second
 */
export const getFPS = () => currentFps;

/**
 * Get average FPS over recent history
 * @returns {number} Average FPS
 */
export const getAverageFPS = () => {
  if (fpsHistory.length === 0) return 60;
  return fpsHistory.reduce((sum, fps) => sum + fps, 0) / fpsHistory.length;
};

/**
 * Get the current performance level
 * @returns {string} Current performance level ('low', 'medium', 'high')
 */
export const getPerformanceLevel = () => performanceLevel;

/**
 * Set the performance level
 * @param {string} level - Performance level ('low', 'medium', 'high')
 */
export const setPerformanceLevel = (level) => {
  if (PERFORMANCE_SETTINGS[level]) {
    console.log(`Setting performance level: ${level}`);
    performanceLevel = level;
  }
};

/**
 * Get current performance settings based on performance level
 * @returns {Object} Performance settings
 */
export const getCurrentSettings = () => PERFORMANCE_SETTINGS[performanceLevel];

/**
 * Determine if a player should be rendered based on distance and settings
 * @param {Array} playerPosition - Player position [x, y, z]
 * @param {Array} cameraPosition - Camera position [x, y, z]
 * @returns {boolean} Whether the player should be rendered
 */
export const shouldRenderPlayer = (playerPosition, cameraPosition) => {
  const settings = PERFORMANCE_SETTINGS[performanceLevel];

  // Calculate distance (simplified for performance)
  const dx = playerPosition[0] - cameraPosition[0];
  const dz = playerPosition[2] - cameraPosition[2];
  const distanceSquared = dx * dx + dz * dz;

  // Check if within render distance
  return distanceSquared <= settings.renderDistance * settings.renderDistance;
};

/**
 * Determine if a player should use low detail model
 * @param {Array} playerPosition - Player position [x, y, z]
 * @param {Array} cameraPosition - Camera position [x, y, z]
 * @returns {boolean} Whether to use low detail model
 */
export const useLowDetailModel = (playerPosition, cameraPosition) => {
  const settings = PERFORMANCE_SETTINGS[performanceLevel];

  // Calculate distance (simplified for performance)
  const dx = playerPosition[0] - cameraPosition[0];
  const dz = playerPosition[2] - cameraPosition[2];
  const distanceSquared = dx * dx + dz * dz;

  // Check if outside billboard distance
  return (
    distanceSquared > settings.billboardDistance * settings.billboardDistance
  );
};

/**
 * Filter players to render based on distance and maximum count
 * @param {Object} players - Object with player data
 * @param {Array} cameraPosition - Camera position [x, y, z]
 * @returns {Object} Filtered players to render
 */
export const getPlayersToRender = (players, cameraPosition) => {
  const settings = PERFORMANCE_SETTINGS[performanceLevel];
  const playerList = Object.entries(players);

  // Sort players by distance to camera
  const sortedPlayers = playerList
    .map(([id, player]) => {
      const dx = player.position[0] - cameraPosition[0];
      const dz = player.position[2] - cameraPosition[2];
      const distanceSquared = dx * dx + dz * dz;
      return { id, player, distanceSquared };
    })
    .filter(
      (item) =>
        item.distanceSquared <=
        settings.renderDistance * settings.renderDistance
    )
    .sort((a, b) => a.distanceSquared - b.distanceSquared)
    .slice(0, settings.maxVisiblePlayers);

  // Convert back to object format
  return sortedPlayers.reduce((obj, { id, player }) => {
    obj[id] = player;
    return obj;
  }, {});
};

/**
 * Track network traffic
 * @param {number} bytes - Bytes sent or received
 * @param {string} direction - 'sent' or 'received'
 */
export const trackNetworkTraffic = (bytes, direction) => {
  if (direction === "sent") {
    networkStats.bytesSent += bytes;
    networkStats.messagesSent++;
  } else {
    networkStats.bytesReceived += bytes;
    networkStats.messagesReceived++;
  }
};

/**
 * Reset network stats
 */
export const resetNetworkStats = () => {
  networkStats = {
    bytesSent: 0,
    bytesReceived: 0,
    messagesSent: 0,
    messagesReceived: 0,
    lastResetTime: Date.now(),
  };
};

/**
 * Get current network stats
 * @returns {Object} Network statistics
 */
export const getNetworkStats = () => {
  const now = Date.now();
  const elapsedSeconds = (now - networkStats.lastResetTime) / 1000;

  return {
    ...networkStats,
    bytesSentPerSecond:
      elapsedSeconds > 0
        ? Math.round(networkStats.bytesSent / elapsedSeconds)
        : 0,
    bytesReceivedPerSecond:
      elapsedSeconds > 0
        ? Math.round(networkStats.bytesReceived / elapsedSeconds)
        : 0,
    messagesSentPerSecond:
      elapsedSeconds > 0
        ? (networkStats.messagesSent / elapsedSeconds).toFixed(2)
        : 0,
    messagesReceivedPerSecond:
      elapsedSeconds > 0
        ? (networkStats.messagesReceived / elapsedSeconds).toFixed(2)
        : 0,
  };
};

// Initialize performance monitoring
initPerformanceMonitor();
