/**
 * Global configuration settings for PaintBlast
 */

// Server connection settings - Updated for Render deployment
export const SERVER_URL = "https://paintblast-server.onrender.com";

// Game mode settings
export const IS_MULTIPLAYER = true; // Default to multiplayer mode
export const AUTO_CONNECT_TO_BEST_SERVER = false;

// Lobby and queue settings
export const MAX_PLAYERS = 100;
export const MAX_PLAYERS_PER_TEAM = 50; // Maximum players per team
export const ENABLE_QUEUE = true; // Enable queuing system for full servers
export const QUEUE_REFRESH_INTERVAL = 5000; // ms
export const SERVER_STATUS_REFRESH_RATE = 5000; // ms

// Performance settings
export const POSITION_UPDATE_INTERVAL = 100; // How often to send position updates (ms)
export const POSITION_UPDATE_THRESHOLD = 0.5; // Minimum position change to trigger update (units)
export const ROTATION_UPDATE_THRESHOLD = 0.1; // Minimum rotation change to trigger update (radians)

// Dynamic player rendering settings
export const MAX_RENDERED_PLAYERS = 20; // Maximum number of players to render at once
export const PLAYER_RENDER_DISTANCE = 100; // Maximum distance to render other players
export const LOW_DETAIL_DISTANCE = 50; // Distance at which to switch to low detail models

// Network optimization
export const BATCH_UPDATES = true; // Whether to batch position updates
export const BATCH_UPDATE_INTERVAL = 200; // How often to send batched updates (ms)
export const COMPRESSION_ENABLED = true; // Whether to enable network compression

// Graphics settings defaults
export const DEFAULT_PERFORMANCE_LEVEL = "medium"; // "low", "medium", "high"
export const DYNAMIC_QUALITY_ADJUSTMENT = true; // Auto-adjust graphics based on FPS

// FPS thresholds for dynamic quality adjustment
export const FPS_THRESHOLDS = {
  low: 30, // Switch to low quality below 30 FPS
  medium: 45, // Switch to medium quality below 45 FPS
  high: 60, // Target FPS for high quality
};

// Game mechanics settings
export const RESPAWN_TIME = 3000; // ms
export const ROUND_TIME = 600; // seconds (10 minutes)
export const FLAG_SCORE_POINTS = 1; // Points for scoring a flag
export const WIN_SCORE = 3; // Score needed to win

// Debug settings
export const DEBUG_MODE = process.env.NODE_ENV === "development";
export const SHOW_PLAYER_POSITIONS = DEBUG_MODE;
export const SHOW_PHYSICS_DEBUG = DEBUG_MODE;
export const SHOW_PERFORMANCE_STATS = DEBUG_MODE;
export const NETWORK_STATS_ENABLED = DEBUG_MODE;
