/**
 * Global configuration settings for PaintBlast
 */

// Server connection settings
export const SERVER_URL = "http://localhost:8000";

// Game mode settings
export const IS_MULTIPLAYER = false; // Set to true to enable multiplayer mode
export const AUTO_CONNECT_TO_BEST_SERVER = false; // Set to true to connect to the best available server automatically

// Lobby and queue settings
export const MAX_PLAYERS = 100; // Maximum players per server
export const MAX_PLAYERS_PER_TEAM = 50; // Maximum players per team
export const ENABLE_QUEUE = true; // Enable queuing system for full servers
export const QUEUE_REFRESH_INTERVAL = 5000; // How often to refresh queue position (ms)

// Performance settings
export const DEFAULT_QUALITY = "medium"; // low, medium, high
export const DYNAMIC_QUALITY = true; // Automatically adjust quality based on player count and FPS

// Game mechanics settings
export const RESPAWN_TIME = 3000; // ms
export const ROUND_TIME = 600; // seconds (10 minutes)
export const FLAG_SCORE_POINTS = 1; // Points for scoring a flag
export const WIN_SCORE = 3; // Score needed to win

// Network settings
export const POSITION_UPDATE_RATE = 100; // How often to send position updates (ms)
export const SERVER_STATUS_REFRESH_RATE = 5000; // How often to refresh server status (ms)

// Debug settings
export const DEBUG_MODE = process.env.NODE_ENV === "development";
export const SHOW_PLAYER_POSITIONS = DEBUG_MODE;
export const SHOW_PHYSICS_DEBUG = DEBUG_MODE;
export const SHOW_PERFORMANCE_METRICS = true; // Show FPS counter and performance metrics
