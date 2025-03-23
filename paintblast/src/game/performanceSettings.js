// Performance settings for the game
// These values can be adjusted based on the device's capabilities

// Check if we're in a browser environment
const isBrowser =
  typeof window !== "undefined" && typeof navigator !== "undefined";

// Detect if we're running on a lower-end device
const isLowEndDevice = () => {
  // Only run this check in browser environment
  if (!isBrowser) return false;

  // Check for mobile devices
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // Check for hardware concurrency (CPU cores)
  const hasLowCPU =
    navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;

  // Check memory if available
  const hasLowMemory = navigator?.deviceMemory && navigator.deviceMemory <= 4;

  // Check screen resolution
  const hasLowResolution =
    window.screen.width * window.screen.height <= 1280 * 720;

  // Consider it a low-end device if at least two conditions are true
  const factors = [isMobile, hasLowCPU, hasLowMemory, hasLowResolution];
  const lowEndFactors = factors.filter(Boolean).length;

  return lowEndFactors >= 2;
};

// Auto-detect performance level
const autoDetectPerformanceLevel = () => {
  // Return medium quality for server rendering
  if (!isBrowser) return "medium";

  if (isLowEndDevice()) {
    return "low";
  }

  // Check for WebGL capabilities
  let gl;
  try {
    const canvas = document.createElement("canvas");
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      return "low";
    }

    // Check for max texture size as an indicator of GPU capability
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (maxTextureSize < 8192) {
      return "medium";
    }

    return "high";
  } catch (e) {
    return "medium"; // Default to medium if detection fails
  } finally {
    if (gl && gl.getExtension) {
      try {
        // Clean up WebGL context
        const loseContext = gl.getExtension("WEBGL_lose_context");
        if (loseContext) {
          loseContext.loseContext();
        }
      } catch (e) {
        console.warn("Error cleaning up WebGL context", e);
      }
    }
  }
};

// Default performance level
const DEFAULT_PERFORMANCE_LEVEL = autoDetectPerformanceLevel();

// Settings for different performance levels
const PERFORMANCE_SETTINGS = {
  high: {
    maxPaintballs: 100,
    maxSplats: 200,
    shadowQuality: "high",
    textureQuality: "high",
    modelDetail: "high",
    physicsQuality: "high",
    effectsQuality: "high",
    viewDistance: 300,
    dynamicLights: true,
    antialiasing: true,
    postProcessing: true,
  },
  medium: {
    maxPaintballs: 50,
    maxSplats: 100,
    shadowQuality: "medium",
    textureQuality: "medium",
    modelDetail: "medium",
    physicsQuality: "medium",
    effectsQuality: "medium",
    viewDistance: 200,
    dynamicLights: true,
    antialiasing: true,
    postProcessing: false,
  },
  low: {
    maxPaintballs: 20,
    maxSplats: 50,
    shadowQuality: "low",
    textureQuality: "low",
    modelDetail: "low",
    physicsQuality: "low",
    effectsQuality: "low",
    viewDistance: 150,
    dynamicLights: false,
    antialiasing: false,
    postProcessing: false,
  },
};

// Convert quality names to actual numeric settings
const QUALITY_VALUES = {
  shadow: {
    high: { mapSize: 2048, enabled: true },
    medium: { mapSize: 1024, enabled: true },
    low: { mapSize: 512, enabled: true },
    off: { mapSize: 256, enabled: false },
  },
  physics: {
    high: { iterations: 5, maxPaintballsPerSecond: 10 },
    medium: { iterations: 3, maxPaintballsPerSecond: 5 },
    low: { iterations: 2, maxPaintballsPerSecond: 3 },
  },
  geometry: {
    high: { sphereSegments: 16, cylinderSegments: 16 },
    medium: { sphereSegments: 12, cylinderSegments: 12 },
    low: { sphereSegments: 8, cylinderSegments: 8 },
  },
};

// Performance monitoring variables - only initialize in browser
let fpsSamples = [];
let lastFrameTime = 0;
let frameIndex = 0;

// Function to monitor FPS - only run in browser
const monitorPerformance = (timestamp) => {
  if (!isBrowser) return;

  if (lastFrameTime > 0) {
    const fps = 1000 / (timestamp - lastFrameTime);
    fpsSamples.push(fps);

    // Keep only the last 60 samples
    if (fpsSamples.length > 60) {
      fpsSamples.shift();
    }
  }

  lastFrameTime = timestamp;
  frameIndex++;

  // Request the next frame
  requestAnimationFrame(monitorPerformance);
};

// Start monitoring only in browser environment
if (isBrowser) {
  requestAnimationFrame(monitorPerformance);
}

// Get average FPS
const getAverageFPS = () => {
  if (!isBrowser || fpsSamples.length === 0) return 60;
  return fpsSamples.reduce((sum, fps) => sum + fps, 0) / fpsSamples.length;
};

// Dynamically adjust settings based on performance
const getDynamicSettings = () => {
  // Start with the default performance level
  const currentSettings = {
    ...PERFORMANCE_SETTINGS[DEFAULT_PERFORMANCE_LEVEL],
  };

  // Only check FPS in browser environment
  if (isBrowser && frameIndex % 300 === 0) {
    const currentFPS = getAverageFPS();

    // Adjust settings based on FPS
    if (currentFPS < 30 && DEFAULT_PERFORMANCE_LEVEL !== "low") {
      // Downgrade to lower settings
      return { ...PERFORMANCE_SETTINGS["low"] };
    } else if (currentFPS < 50 && DEFAULT_PERFORMANCE_LEVEL === "high") {
      // Downgrade from high to medium
      return { ...PERFORMANCE_SETTINGS["medium"] };
    }
  }

  return currentSettings;
};

// Export the settings
export {
  PERFORMANCE_SETTINGS,
  QUALITY_VALUES,
  DEFAULT_PERFORMANCE_LEVEL,
  getDynamicSettings,
  getAverageFPS,
};
