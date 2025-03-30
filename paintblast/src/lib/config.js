/**
 * Global configuration settings for PaintBlast
 */

// Server connection settings
export const SERVER_URL = "http://localhost:8000";

// Game mode settings
export const IS_MULTIPLAYER = false; // Set to true to enable multiplayer mode

// Performance settings
export const DEFAULT_QUALITY = "medium"; // low, medium, high

// Game mechanics settings
export const MAX_PLAYERS_PER_TEAM = 4;
export const RESPAWN_TIME = 3000; // ms
export const ROUND_TIME = 300; // seconds

// Debug settings
export const DEBUG_MODE = process.env.NODE_ENV === "development";
export const SHOW_PLAYER_POSITIONS = DEBUG_MODE;
export const SHOW_PHYSICS_DEBUG = DEBUG_MODE;
