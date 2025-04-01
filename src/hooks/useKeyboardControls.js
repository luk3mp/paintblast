import { useState, useEffect } from "react";

// Define the keyboard state
const keyboardState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  shoot: false,
  reload: false,
  refill: false,
  capture: false, // Add flag capture key
};

// Create a listener function to update global state
function handleKeyDown(e) {
  switch (e.code) {
    case "KeyW":
    case "ArrowUp":
      keyboardState.forward = true;
      break;
    case "KeyS":
    case "ArrowDown":
      keyboardState.backward = true;
      break;
    case "KeyA":
    case "ArrowLeft":
      keyboardState.left = true;
      break;
    case "KeyD":
    case "ArrowRight":
      keyboardState.right = true;
      break;
    case "Space":
      keyboardState.jump = true;
      break;
    case "KeyR":
      keyboardState.reload = true;
      break;
    case "KeyE":
      keyboardState.refill = true;
      break;
    case "KeyF":
      keyboardState.capture = true;
      break;
    default:
      break;
  }
}

function handleKeyUp(e) {
  switch (e.code) {
    case "KeyW":
    case "ArrowUp":
      keyboardState.forward = false;
      break;
    case "KeyS":
    case "ArrowDown":
      keyboardState.backward = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      keyboardState.left = false;
      break;
    case "KeyD":
    case "ArrowRight":
      keyboardState.right = false;
      break;
    case "Space":
      keyboardState.jump = false;
      break;
    case "KeyR":
      keyboardState.reload = false;
      break;
    case "KeyE":
      keyboardState.refill = false;
      break;
    case "KeyF":
      keyboardState.capture = false;
      break;
    default:
      break;
  }
}

function handleMouseDown(e) {
  if (e.button === 0) {
    // Left mouse button
    keyboardState.shoot = true;
  }
}

function handleMouseUp(e) {
  if (e.button === 0) {
    // Left mouse button
    keyboardState.shoot = false;
  }
}

// Set up the global event listeners once
let listenersInitialized = false;

export function initKeyboardListeners() {
  if (listenersInitialized) return;

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mouseup", handleMouseUp);

  listenersInitialized = true;

  // Clean up function for unmounting
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mouseup", handleMouseUp);
    listenersInitialized = false;
  };
}

// Custom hook to access the keyboard state
export function useKeyboardControls(select) {
  const [state, setState] = useState(
    select ? select(keyboardState) : keyboardState
  );

  useEffect(() => {
    // Set up the global event listeners
    const cleanup = initKeyboardListeners();

    // Create a subscription to update component state
    function handleChange() {
      const newState = select ? select(keyboardState) : keyboardState;
      setState(newState);
    }

    // Set up a regular interval to check for state changes
    const intervalId = setInterval(handleChange, 16); // ~60fps

    return () => {
      clearInterval(intervalId);
      if (cleanup) cleanup();
    };
  }, [select]);

  return state;
}
