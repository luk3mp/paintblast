/**
 * Custom event system for PaintBlast
 *
 * This module provides a simple way to emit and listen for custom events
 * that need to be shared between components without prop drilling.
 */

// Define event names
export const EVENTS = {
  QUEUE_UPDATE: "queueUpdate",
  QUEUE_READY: "queueReady",
  SERVER_STATUS_UPDATE: "serverStatusUpdate",
  CONNECTION_STATE_CHANGE: "connectionStateChange",
  GAME_START: "gameStart",
  GAME_END: "gameEnd",
  PLAYER_KILLED: "playerKilled",
  FLAG_CAPTURED: "flagCaptured",
  FLAG_RETURNED: "flagReturned",
  FLAG_SCORED: "flagScored",
};

/**
 * Emit a custom event with data
 * @param {string} eventName - Name of the event
 * @param {Object} data - Data to pass with the event
 */
export const emitEvent = (eventName, data = {}) => {
  // Create a custom event with the data
  const event = new CustomEvent(eventName, { detail: data });

  // Dispatch the event
  window.dispatchEvent(event);

  // Log event in development mode
  if (process.env.NODE_ENV === "development") {
    console.log(`Event emitted: ${eventName}`, data);
  }
};

/**
 * Add a listener for a custom event
 * @param {string} eventName - Name of the event
 * @param {Function} callback - Callback function to run when event is triggered
 * @returns {Function} - Function to remove the event listener
 */
export const addEventListener = (eventName, callback) => {
  // Create a wrapper function that extracts the detail property
  const wrappedCallback = (event) => {
    callback(event.detail);
  };

  // Add the event listener
  window.addEventListener(eventName, wrappedCallback);

  // Return a function to remove the event listener
  return () => {
    window.removeEventListener(eventName, wrappedCallback);
  };
};

/**
 * Remove a listener for a custom event
 * @param {string} eventName - Name of the event
 * @param {Function} callback - Callback function to remove
 */
export const removeEventListener = (eventName, callback) => {
  window.removeEventListener(eventName, callback);
};

/**
 * Create a hook to use custom events in React components
 * @param {string} eventName - Name of the event
 * @param {Function} defaultHandler - Default handler for the event
 * @returns {Array} - Array containing [addEventListener, removeEventListener] functions
 */
export const useEventListener = (eventName, defaultHandler) => {
  const addListener = (callback = defaultHandler) => {
    if (!callback) return () => {};
    return addEventListener(eventName, callback);
  };

  const removeListener = (callback) => {
    removeEventListener(eventName, callback);
  };

  return [addListener, removeListener];
};
