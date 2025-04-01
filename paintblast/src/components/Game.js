import { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky, PointerLockControls } from "@react-three/drei";
import io from "socket.io-client";
import Player from "../game/player";
import Map from "../game/map";
import HUD from "./HUD";
import Chat from "./Chat";
import styles from "../styles/Game.module.css";
import Paintball from "../game/paintball";
import { Physics } from "@react-three/rapier";
import PhysicsDebug from "../game/debug";
import {
  DEFAULT_PERFORMANCE_LEVEL,
  PERFORMANCE_SETTINGS,
  QUALITY_VALUES,
  getDynamicSettings,
  getAverageFPS,
} from "../game/performanceSettings";
import { EVENTS, addEventListener } from "../lib/events";
import PerformanceStats from "./PerformanceStats";
import {
  updateFps,
  getCurrentSettings,
  getPlayersToRender,
  shouldRenderPlayer,
} from "../lib/performance";
import { SHOW_PERFORMANCE_STATS, PLAYER_RENDER_DISTANCE } from "../lib/config";
import {
  sendPositionUpdate,
  getConnectionState,
  getSocket,
  connectSocket,
} from "../lib/socket";
import SoundFX from "../lib/soundEffects";

export default function Game({ playerName, isMultiplayer = false, onGameEnd }) {
  const [socket, setSocket] = useState(null);
  const [players, setPlayers] = useState({});
  const [messages, setMessages] = useState([]);
  const [gameStats, setGameStats] = useState({
    score: 0,
    health: 100,
    chamberAmmo: 30, // Ammo in the current magazine
    canistersRemaining: 2, // Number of full canisters remaining
    maxAmmo: 90,
    redScore: 0,
    blueScore: 0,
    team: null, // Player's team
  });
  const [isGameReady, setIsGameReady] = useState(false);
  const [paintballs, setPaintballs] = useState([]);
  const [splats, setSplats] = useState([]);
  const [playerReloadState, setPlayerReloadState] = useState({
    isReloading: false,
    reloadProgress: 0,
    currentBatch: 0,
  });

  // Add a debounce mechanism to the handleReload function
  const reloadTimeoutRef = useRef(null);

  // Add a reload lock to prevent multiple reloads
  const [isReloadLocked, setIsReloadLocked] = useState(false);

  // Add a state to track if a reload is in progress
  const [isReloadInProgress, setIsReloadInProgress] = useState(false);

  // Add state for replenish status
  const [playerReplenishState, setPlayerReplenishState] = useState({
    isReplenishing: false,
    replenishProgress: 0,
    isNearCanisterCrate: false,
  });

  // Add these near the top of the Game component
  const [performanceLevel, setPerformanceLevel] = useState(
    DEFAULT_PERFORMANCE_LEVEL
  );
  const [performanceSettings, setPerformanceSettings] = useState(
    PERFORMANCE_SETTINGS[DEFAULT_PERFORMANCE_LEVEL]
  );
  const [lastFpsCheck, setLastFpsCheck] = useState(0);
  const fpsMonitorInterval = useRef(null);
  const paintballCounter = useRef(0);
  const lastPaintballTime = useRef(0);

  // Add this with the other state declarations
  const [debugInfo, setDebugInfo] = useState({
    fps: 60,
    performanceLevel: DEFAULT_PERFORMANCE_LEVEL,
    activePaintballs: 0,
    isGameReady: false,
    playerCount: 0,
    socketConnected: false,
  });

  // Modify the playerTeam state to use null as initial value
  const [playerTeam, setPlayerTeam] = useState(null);

  // Add this with the other ref declarations
  const playerRef = useRef(null);

  // Add a ref to track if the player has been spawned
  const hasSpawnedPlayer = useRef(false);

  // Set up one-time team positions in a global variable that persists across re-renders
  const teamPositions = {
    Red: null,
    Blue: null,
  };

  // Add state for flag capture mechanic
  const [flagState, setFlagState] = useState({
    redFlagCaptured: false,
    blueFlagCaptured: false,
    redFlagCarrier: null,
    blueFlagCarrier: null,
  });

  // Add state for player flag interaction
  const [playerFlagState, setPlayerFlagState] = useState({
    isCarryingFlag: false,
    carryingFlagTeam: null,
    nearFlagTeam: null,
    nearHomeBase: false,
  });

  // Add isShooting state for gun animation
  const [isShooting, setIsShooting] = useState(false);

  // --- NEW STATE for Respawn and Kill Feed ---
  const [isRespawning, setIsRespawning] = useState(false);
  const [respawnCountdown, setRespawnCountdown] = useState(0);
  const [lastKiller, setLastKiller] = useState(null); // Store killer info
  const [killFeed, setKillFeed] = useState([]); // Store kill messages {id, text}
  const respawnIntervalRef = useRef(null); // Ref for countdown interval
  const MAX_KILL_FEED_MESSAGES = 5; // Max messages to show
  // --- End NEW STATE ---

  // Add this useEffect for performance monitoring
  useEffect(() => {
    // Set up a timer to check performance periodically
    const monitorPerformance = () => {
      const currentFps = getAverageFPS();

      // Update debug info
      setDebugInfo((prev) => ({
        ...prev,
        fps: Math.round(currentFps),
        performanceLevel,
        activePaintballs: paintballs.length,
        isGameReady,
        playerCount: Object.keys(players).length,
        socketConnected: socket?.connected,
      }));

      // Only adjust settings if performance drops significantly
      if (currentFps < 30 && performanceLevel !== "low") {
        console.log(
          `Performance issue detected (${currentFps.toFixed(
            1
          )} FPS). Switching to low quality.`
        );
        setPerformanceLevel("low");
        setPerformanceSettings(PERFORMANCE_SETTINGS["low"]);
      } else if (currentFps < 45 && performanceLevel === "high") {
        console.log(
          `Performance issue detected (${currentFps.toFixed(
            1
          )} FPS). Switching to medium quality.`
        );
        setPerformanceLevel("medium");
        setPerformanceSettings(PERFORMANCE_SETTINGS["medium"]);
      }
    };

    // Monitor every 5 seconds
    fpsMonitorInterval.current = setInterval(monitorPerformance, 5000);

    return () => {
      if (fpsMonitorInterval.current) {
        clearInterval(fpsMonitorInterval.current);
      }
    };
  }, [performanceLevel, paintballs.length, isGameReady, players, socket]);

  useEffect(() => {
    // Only set up the socket connection if we actually need it
    if (isMultiplayer) {
      // Import the socket utilities
      const {
        getSocket,
        connectSocket,
        isConnected,
        getConnectionState,
      } = require("../lib/socket");

      // Get the existing socket or create a new one if needed
      let socketInstance = getSocket();

      if (!socketInstance || !isConnected()) {
        // Connect to the socket if we don't have a connection
        socketInstance = connectSocket({ multiplayer: true });
      }

      // Set up event listeners for the queue and connection state
      const removeConnectionListener = addEventListener(
        EVENTS.CONNECTION_STATE_CHANGE,
        (data) => {
          // If the connection state changes to queued, we need to notify the parent
          if (data.state === "queued") {
            onGameEnd();
          }
        }
      );

      const removeQueueReadyListener = addEventListener(
        EVENTS.QUEUE_READY,
        () => {
          console.log("Player can now join the game!");
        }
      );

      // Set up event listeners for game events
      const removePlayerKilledListener = addEventListener(
        EVENTS.PLAYER_KILLED,
        (data) => {
          console.log(`Player killed: ${data.player} by ${data.killer}`);
        }
      );

      const removeFlagCapturedListener = addEventListener(
        EVENTS.FLAG_CAPTURED,
        (data) => {
          // Update flag state based on data
          setFlagState((prev) => {
            if (data.team === "red") {
              return {
                ...prev,
                redFlagCaptured: true,
                redFlagCarrier: data.carrier,
              };
            } else if (data.team === "blue") {
              return {
                ...prev,
                blueFlagCaptured: true,
                blueFlagCarrier: data.carrier,
              };
            }
            return prev;
          });
        }
      );

      const removeFlagReturnedListener = addEventListener(
        EVENTS.FLAG_RETURNED,
        (data) => {
          // Update flag state based on data
          setFlagState((prev) => {
            if (data.team === "red") {
              return {
                ...prev,
                redFlagCaptured: false,
                redFlagCarrier: null,
              };
            } else if (data.team === "blue") {
              return {
                ...prev,
                blueFlagCaptured: false,
                blueFlagCarrier: null,
              };
            }
            return prev;
          });
        }
      );

      const removeFlagScoredListener = addEventListener(
        EVENTS.FLAG_SCORED,
        (data) => {
          // Update score based on data
          setGameStats((prev) => ({
            ...prev,
            redScore: data.redScore,
            blueScore: data.blueScore,
          }));

          // Reset flag state
          setFlagState((prev) => {
            if (data.team === "red") {
              return {
                ...prev,
                redFlagCaptured: false,
                redFlagCarrier: null,
              };
            } else if (data.team === "blue") {
              return {
                ...prev,
                blueFlagCaptured: false,
                blueFlagCarrier: null,
              };
            }
            return prev;
          });
        }
      );

      const removeGameStartListener = addEventListener(
        EVENTS.GAME_START,
        (data) => {
          console.log("Game is starting!", data);
        }
      );

      const removeGameOverListener = addEventListener(
        EVENTS.GAME_OVER,
        (data) => {
          console.log("Game is over!", data);
          onGameEnd();
        }
      );

      // Set up direct socket event listeners
      socketInstance.on("players", (data) => {
        setPlayers(data);
      });

      socketInstance.on("message", (message) => {
        setMessages((prev) => [...prev, message]);
      });

      // Join the game
      const assignedTeam = Math.random() < 0.5 ? "Red" : "Blue"; // Default team, server will override
      console.log("Requesting team:", assignedTeam);

      // Update game stats with the team
      setPlayerTeam(assignedTeam);
      setGameStats((prev) => ({
        ...prev,
        team: assignedTeam,
      }));

      // Send join request to server
      socketInstance.emit("join", {
        name: playerName,
        team: assignedTeam,
      });

      // Register for join success
      socketInstance.on("joinSuccess", (data) => {
        // Server has confirmed our join and assigned a team
        console.log("Join success:", data);
        setPlayerTeam(data.team);
        setGameStats((prev) => ({
          ...prev,
          team: data.team,
        }));
      });

      // Set the socket state
      setSocket(socketInstance);

      // Clean up listeners
      return () => {
        removeConnectionListener();
        removeQueueReadyListener();
        removePlayerKilledListener();
        removeFlagCapturedListener();
        removeFlagReturnedListener();
        removeFlagScoredListener();
        removeGameStartListener();
        removeGameOverListener();

        // We don't disconnect here because that would break the queue system
        // The socket will be managed by the socket.js utility
      };
    } else {
      // For single player, we use the mock socket from socket.js
      const { connectSocket, getSocket } = require("../lib/socket");
      const mockSocket = connectSocket({ multiplayer: false });

      // Set up single player mode with the mock socket
      setSocket(mockSocket);

      // Random team assignment
      const assignedTeam = Math.random() < 0.5 ? "Red" : "Blue";
      setPlayerTeam(assignedTeam);
      setGameStats((prev) => ({
        ...prev,
        team: assignedTeam,
      }));

      // Handle single player messages
      mockSocket.on("message", (message) => {
        setMessages((prev) => [...prev, message]);
      });

      // Clean up
      return () => {
        // No need to disconnect the mock socket
      };
    }
  }, [playerName, onGameEnd, isMultiplayer]);

  const sendMessage = (text) => {
    if (socket && text.trim()) {
      socket.emit("message", {
        text,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const updatePlayerPosition = (position, rotation) => {
    if (socket && isMultiplayer) {
      // Use the optimized position update function
      sendPositionUpdate(position, rotation);
    }
  };

  const handleShoot = (position, direction) => {
    // Apply rate limiting based on performance settings
    const now = Date.now();
    const timeSinceLastShot = now - lastPaintballTime.current;
    const maxFireRate =
      1000 / QUALITY_VALUES.physics[performanceLevel].maxPaintballsPerSecond;

    if (timeSinceLastShot < maxFireRate) {
      return; // Rate limit exceeded
    }

    // Set shooting animation flag
    setIsShooting(true);

    // Play shooting sound with slight pitch variation for variety
    SoundFX.play("shot", {
      pitch: 0.9 + Math.random() * 0.2, // Random pitch between 0.9 and 1.1
      volume: 0.8,
    });

    // Reset shooting flag after a short delay
    setTimeout(() => {
      setIsShooting(false);
    }, 100);

    // Apply maximum paintball count limit
    if (paintballs.length >= performanceSettings.maxPaintballs) {
      // Remove oldest paintball if we've hit the limit
      setPaintballs((prev) => prev.slice(1));
    }

    // Update the last paintball time
    lastPaintballTime.current = now;

    // Update game stats - reduce ammo
    setGameStats((prev) => ({
      ...prev,
      chamberAmmo: Math.max(0, prev.chamberAmmo - 1),
    }));

    // Generate a unique ID for this paintball
    const paintballId = `paintball-${paintballCounter.current++}`;

    // Create a new paintball with color based on team
    const paintballColor = playerTeam === "Red" ? "#ff0000" : "#0066ff";

    const newPaintball = {
      id: paintballId,
      position,
      direction,
      color: paintballColor, // Use team color
    };

    // Add the new paintball to the state
    setPaintballs((prev) => [...prev, newPaintball]);

    // Notify server about the shot
    if (socket) {
      socket.emit("shoot", {
        origin: position,
        direction,
        color: newPaintball.color,
        id: paintballId,
      });
    }
  };

  const handleReload = () => {
    // Only allow reload when chamber is empty
    if (gameStats.chamberAmmo > 0) {
      console.log("Cannot reload: Chamber still has ammo");
      return;
    }

    // If reload is already in progress, don't start another one
    if (isReloadInProgress) {
      console.log("Reload already in progress");
      return;
    }

    // Check if we have any canisters left
    if (gameStats.canistersRemaining <= 0) {
      console.log("No canisters left to reload with!");
      return;
    }

    // Mark reload as in progress
    setIsReloadInProgress(true);

    // We'll update the actual ammo when the reload is complete
    // This will be called by the Player component when the reload animation is done
  };

  // Add a new function to handle reload completion
  const handleReloadComplete = () => {
    // Only process if a reload is in progress
    if (!isReloadInProgress) return;

    // Update the ammo state
    setGameStats((prev) => {
      // Double-check that we have canisters left
      if (prev.canistersRemaining <= 0) {
        console.log("No canisters left to reload with!");
        setIsReloadInProgress(false);
        return prev;
      }

      // Use one canister to refill the chamber
      const newCanistersRemaining = prev.canistersRemaining - 1;

      console.log(
        `Reloaded chamber! Canisters remaining: ${newCanistersRemaining}`
      );

      return {
        ...prev,
        chamberAmmo: 30, // Full chamber
        canistersRemaining: newCanistersRemaining, // Use one canister
      };
    });

    // Mark reload as complete
    setIsReloadInProgress(false);
  };

  // Clean up the timeout on unmount
  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
    };
  }, []);

  const handlePaintballHit = (id, hitInfo) => {
    // Apply maximum splat count limit
    const currentSplats = splats.length;

    if (hitInfo && currentSplats >= performanceSettings.maxSplats) {
      // Remove oldest splat if we've hit the limit
      setSplats((prev) => prev.slice(1));
    }

    // Create a new splat if hitInfo is provided
    if (hitInfo) {
      const newSplat = {
        id: `splat-${id}`,
        position: hitInfo.position,
        normal: hitInfo.normal,
        color: hitInfo.color,
        timestamp: Date.now(),
      };

      // Add the new splat to state
      setSplats((prev) => [...prev, newSplat]);
    }

    // Remove the paintball by ID
    setPaintballs((prev) => prev.filter((p) => p.id !== id));
  };

  // Add a function to handle canister replenishment
  const handleReplenish = () => {
    // Update the game stats to refill canisters and chamber
    setGameStats((prev) => ({
      ...prev,
      canistersRemaining: 2, // Set to full 2 canisters
      chamberAmmo: 30, // Fill the chamber completely
    }));

    console.log(
      "Replenished canisters and chamber! Now have 2 full canisters and a full chamber."
    );
  };

  // Update the setPlayerState function to handle both reload and replenish states
  const setPlayerState = (state) => {
    if ("isReloading" in state) {
      setPlayerReloadState(state);
    }
    if ("isReplenishing" in state) {
      setPlayerReplenishState(state);
    }
    if ("isNearCanisterCrate" in state) {
      setPlayerReplenishState((prev) => ({
        ...prev,
        isNearCanisterCrate: state.isNearCanisterCrate,
      }));
    }
    if (
      "nearFlagTeam" in state ||
      "isCarryingFlag" in state ||
      "carryingFlagTeam" in state ||
      "nearHomeBase" in state
    ) {
      setPlayerFlagState((prev) => ({
        ...prev,
        nearFlagTeam:
          state.nearFlagTeam !== undefined
            ? state.nearFlagTeam
            : prev.nearFlagTeam,
        isCarryingFlag:
          state.isCarryingFlag !== undefined
            ? state.isCarryingFlag
            : prev.isCarryingFlag,
        carryingFlagTeam:
          state.carryingFlagTeam !== undefined
            ? state.carryingFlagTeam
            : prev.carryingFlagTeam,
        nearHomeBase:
          state.nearHomeBase !== undefined
            ? state.nearHomeBase
            : prev.nearHomeBase,
      }));
    }
  };

  // Simplify the start game function to avoid redundant position setting
  const startGame = () => {
    // Apply initial performance settings
    setPerformanceLevel(DEFAULT_PERFORMANCE_LEVEL);
    setPerformanceSettings(PERFORMANCE_SETTINGS[DEFAULT_PERFORMANCE_LEVEL]);

    console.log("Starting game with team:", playerTeam);

    // Double-check team assignment
    if (!playerTeam) {
      // Ensure team is assigned if somehow missed
      const assignedTeam = Math.random() < 0.5 ? "Red" : "Blue";
      console.log("Re-assigning team on game start:", assignedTeam);
      setPlayerTeam(assignedTeam);

      // Update game stats with team
      setGameStats((prev) => ({
        ...prev,
        team: assignedTeam,
      }));
    }

    // Reset any game state
    setPaintballs([]);
    setSplats([]);
    paintballCounter.current = 0;
    lastPaintballTime.current = 0;

    // Reset team positions to force recalculation
    Object.keys(teamPositions).forEach((team) => {
      teamPositions[team] = null;
    });
    console.log("Team positions reset for new game");

    // Lock the pointer and start the game
    setIsGameReady(true);
    lockPointer();

    // Let the Player component handle spawn position - no need to set it here
  };

  // Add this cleanup function after the performance monitoring useEffect
  useEffect(() => {
    // Auto-clean old splats
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      // Keep splats based on performance settings (higher quality = keep longer)
      const maxSplatAge =
        performanceLevel === "high"
          ? 60000
          : performanceLevel === "medium"
          ? 30000
          : 15000;

      setSplats((prev) =>
        prev.filter((splat) => now - splat.timestamp < maxSplatAge)
      );
    }, 10000);

    return () => clearInterval(cleanupInterval);
  }, [performanceLevel]);

  // Add this function before the return statement
  const lockPointer = () => {
    // Check if the Pointer Lock API is supported
    if ("pointerLockElement" in document) {
      const canvas = document.querySelector("canvas");

      // Only attempt to lock if we have a canvas and it's not already locked
      if (canvas && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock =
          canvas.requestPointerLock ||
          canvas.mozRequestPointerLock ||
          canvas.webkitRequestPointerLock;

        // Request pointer lock with error handling
        try {
          canvas.requestPointerLock();
        } catch (error) {
          console.warn("Error requesting pointer lock:", error);
        }
      }
    } else {
      console.warn("Pointer lock API not supported in this browser");
    }
  };

  // Replace the function entirely with a simplified version
  const getSpawnPositionForTeam = (team) => {
    // Default to Blue team if no team provided
    const normalizedTeam =
      team && typeof team === "string" ? team.trim() : "Blue";

    // Only compute once per team per session
    if (teamPositions[normalizedTeam]) {
      return teamPositions[normalizedTeam];
    }

    console.log(
      `GENERATING SPAWN POSITION FOR TEAM ${normalizedTeam} (SHOULD ONLY HAPPEN ONCE PER TEAM)`
    );

    // Generate team position
    const offsetX = Math.random() * 20 - 10;
    let position;

    // IMPORTANT: Make sure Red team spawns at North (-z) and Blue team spawns at South (+z)
    if (normalizedTeam.toLowerCase() === "red") {
      position = [offsetX, 2, -110]; // North (Red team)
    } else {
      position = [offsetX, 2, 110]; // South (Blue team)
    }

    // Cache it permanently
    teamPositions[normalizedTeam] = position;
    console.log(`Team ${normalizedTeam} position cached:`, position);

    return position;
  };

  // Completely replace the team change useEffect to do nothing with position
  useEffect(() => {
    if (playerTeam) {
      console.log("Team finalized:", playerTeam);

      // No position changes here - just log the team change
    }
  }, [playerTeam]);

  // Add a new useEffect to handle team changes with explicit spawn position verification
  useEffect(() => {
    // Only run this when playerTeam is definitively set (not null) and we're in game
    if (playerTeam && isGameReady && playerRef.current) {
      console.log(
        `TEAM CHANGE DETECTED: ${playerTeam}. Enforcing correct spawn location.`
      );

      // Force positions to be recalculated for this team
      teamPositions[playerTeam] = null;

      // Get the correct spawn position for this team
      const correctSpawnPosition = getSpawnPositionForTeam(playerTeam);
      console.log(
        `Correct spawn for ${playerTeam} team:`,
        correctSpawnPosition
      );

      // If the player ref exists, set the position using the ref
      if (playerRef.current && playerRef.current.setTranslation) {
        // Force the player to the correct team position
        console.log(
          `Setting player to correct team position: ${correctSpawnPosition}`
        );
        playerRef.current.setTranslation(
          {
            x: correctSpawnPosition[0],
            y: correctSpawnPosition[1],
            z: correctSpawnPosition[2],
          },
          true
        );
      }
    }
  }, [playerTeam, isGameReady]);

  // Add function to handle flag capture
  const handleFlagCapture = (capturedFlagTeam) => {
    console.log(`Player has captured the ${capturedFlagTeam} flag!`);

    // Set local state
    setPlayerFlagState((prev) => ({
      ...prev,
      isCarryingFlag: true,
      carryingFlagTeam: capturedFlagTeam,
    }));

    // Update flag state
    setFlagState((prev) => {
      // Update the appropriate flag state
      if (capturedFlagTeam === "Red") {
        return {
          ...prev,
          redFlagCaptured: true,
          redFlagCarrier: playerName,
        };
      } else if (capturedFlagTeam === "Blue") {
        return {
          ...prev,
          blueFlagCaptured: true,
          blueFlagCarrier: playerName,
        };
      }
      return prev;
    });

    // Send to server in multiplayer mode
    if (socket && isMultiplayer) {
      socket.emit("captureFlag", {
        team: capturedFlagTeam.toLowerCase(),
      });
    }
  };

  // Add function to handle flag return
  const handleFlagReturn = (returnedFlagTeam) => {
    console.log(`Player has returned the ${returnedFlagTeam} flag to base!`);

    // Reset player flag state
    setPlayerFlagState((prev) => ({
      ...prev,
      isCarryingFlag: false,
      carryingFlagTeam: null,
    }));

    // In multiplayer, the server will handle this and send updates
    if (socket && isMultiplayer) {
      socket.emit("scoreFlag", {
        team: returnedFlagTeam.toLowerCase(),
      });
    } else {
      // In single player, we update the score locally
      setGameStats((prev) => {
        // Only increment score if player's team matches their base
        const newRedScore =
          playerTeam === "Red" && returnedFlagTeam === "Blue"
            ? prev.redScore + 1
            : prev.redScore;

        const newBlueScore =
          playerTeam === "Blue" && returnedFlagTeam === "Red"
            ? prev.blueScore + 1
            : prev.blueScore;

        return {
          ...prev,
          redScore: newRedScore,
          blueScore: newBlueScore,
        };
      });

      // Reset flag state
      setFlagState((prev) => {
        if (returnedFlagTeam === "Red") {
          return {
            ...prev,
            redFlagCaptured: false,
            redFlagCarrier: null,
          };
        } else if (returnedFlagTeam === "Blue") {
          return {
            ...prev,
            blueFlagCaptured: false,
            blueFlagCarrier: null,
          };
        }
        return prev;
      });
    }
  };

  // --- Add Event Listeners in Multiplayer Setup useEffect ---
  useEffect(() => {
    let socketInstance = null;
    // Define cleanup functions array
    const cleanupFunctions = [];

    if (isMultiplayer) {
      // ... existing multiplayer connection logic ...
      const {
        getSocket,
        connectSocket,
        isConnected,
      } = require("../lib/socket");
      socketInstance = getSocket();
      if (!socketInstance || !isConnected()) {
        socketInstance = connectSocket({ multiplayer: true });
      }

      // --- Add New Event Listeners ---

      const handleHealthUpdate = (data) => {
        console.log("Received health update:", data);
        setGameStats((prev) => ({
          ...prev,
          health: data.health,
        }));
      };
      socketInstance.on("healthUpdate", handleHealthUpdate);
      cleanupFunctions.push(() =>
        socketInstance.off("healthUpdate", handleHealthUpdate)
      );

      const handleStartRespawn = (data) => {
        console.log("Received start respawn timer:", data);
        setIsRespawning(true);
        setRespawnCountdown(data.duration);
        setGameStats((prev) => ({ ...prev, health: 0 })); // Ensure health shows 0

        // Clear previous interval if any
        if (respawnIntervalRef.current) {
          clearInterval(respawnIntervalRef.current);
        }

        // Start client-side countdown interval
        respawnIntervalRef.current = setInterval(() => {
          setRespawnCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(respawnIntervalRef.current);
              respawnIntervalRef.current = null;
              // No need to set isRespawning false here, wait for playerRespawned event
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        cleanupFunctions.push(() => {
          if (respawnIntervalRef.current)
            clearInterval(respawnIntervalRef.current);
        });
      };
      socketInstance.on("startRespawnTimer", handleStartRespawn);
      cleanupFunctions.push(() =>
        socketInstance.off("startRespawnTimer", handleStartRespawn)
      );

      const handlePlayerRespawned = (data) => {
        console.log("Received player respawned:", data);
        setIsRespawning(false);
        setLastKiller(null); // Clear killer info
        if (respawnIntervalRef.current) {
          clearInterval(respawnIntervalRef.current);
          respawnIntervalRef.current = null;
        }
        setRespawnCountdown(0);

        // Reset health and potentially update position directly
        setGameStats((prev) => ({
          ...prev,
          health: data.health || 100, // Use health from server or default
        }));

        // Reset player position using the ref
        if (
          playerRef.current &&
          data.position &&
          playerRef.current.setTranslation
        ) {
          console.log("Setting player position on respawn:", data.position);
          playerRef.current.setTranslation(
            { x: data.position[0], y: data.position[1], z: data.position[2] },
            true // Wake up rigid body
          );
        }
        // Re-enable controls (PointerLockControls usually re-enables on click)
        // You might need specific logic if you manually disable player input elsewhere
      };
      socketInstance.on("playerRespawned", handlePlayerRespawned);
      cleanupFunctions.push(() =>
        socketInstance.off("playerRespawned", handlePlayerRespawned)
      );

      const handlePlayerKilled = (data) => {
        console.log("Received player killed:", data);
        const killerName = data.killer?.name || "Unknown";
        const victimName = data.victim?.name || "Unknown";
        const message = `${killerName} eliminated ${victimName}`;
        const messageId = Date.now(); // Simple unique enough ID for React key

        setKillFeed((prev) => {
          const newFeed = [...prev, { id: messageId, text: message }];
          // Limit the number of messages
          if (newFeed.length > MAX_KILL_FEED_MESSAGES) {
            return newFeed.slice(newFeed.length - MAX_KILL_FEED_MESSAGES);
          }
          return newFeed;
        });

        // If the local player was the victim, store killer info
        const localPlayerId = getSocket()?.id; // Get local socket ID safely
        if (localPlayerId && data.victim?.id === localPlayerId) {
          setLastKiller(killerName);
        }
      };
      socketInstance.on("playerKilled", handlePlayerKilled);
      cleanupFunctions.push(() =>
        socketInstance.off("playerKilled", handlePlayerKilled)
      );

      const handleStatsUpdate = (data) => {
        console.log("Received stats update:", data);
        setGameStats((prev) => ({
          ...prev,
          ...data, // Directly merge received stats (kills, deaths, score)
        }));
      };
      socketInstance.on("statsUpdate", handleStatsUpdate);
      cleanupFunctions.push(() =>
        socketInstance.off("statsUpdate", handleStatsUpdate)
      );

      // --- End New Event Listeners ---

      // ... existing event listeners (players, message, joinSuccess, flags etc.) ...
      const removePlayerListener = addEventListener(
        EVENTS.PLAYERS_UPDATE,
        (data) => {
          setPlayers(data);
        }
      );
      cleanupFunctions.push(removePlayerListener);
      // Add other existing listeners to cleanupFunctions...

      // Join game logic...
      socketInstance.emit("join", { name: playerName, team: assignedTeam });
      // ...
    } else {
      // ... existing single player setup ...
    }

    // Set the socket state
    setSocket(socketInstance);

    // Cleanup function
    return () => {
      console.log("Cleaning up Game component listeners...");
      cleanupFunctions.forEach((cleanup) => cleanup());
      // Clear respawn interval on unmount
      if (respawnIntervalRef.current) {
        clearInterval(respawnIntervalRef.current);
      }
      // We don't disconnect socket here anymore if managed globally
    };
    // Ensure dependencies cover new state used in handlers if needed
  }, [playerName, onGameEnd, isMultiplayer]); // Add isShooting, playerReloadState if they affect listeners

  return (
    <div className={styles.gameContainer}>
      {!isGameReady && !isRespawning && (
        <div
          className={styles.startOverlay}
          onClick={() => {
            // Set the team if not already set
            if (!playerTeam) {
              const assignedTeam = Math.random() < 0.5 ? "Red" : "Blue";
              setPlayerTeam(assignedTeam);
              console.log("Setting team on click:", assignedTeam);
            }

            // Reset the spawn flag when starting a new game
            hasSpawnedPlayer.current = false;

            startGame();
          }}
        >
          <div className={styles.startPrompt}>
            <h2>PaintBlast</h2>
            <p>Click to start the game</p>
            <p>WASD to move, Mouse to aim, Click to shoot</p>
          </div>
        </div>
      )}

      {/* Respawn Overlay */}
      {isRespawning && (
        <div className={styles.respawnOverlay}>
          <h1>YOU WERE ELIMINATED</h1>
          {lastKiller && <p>By: {lastKiller}</p>}
          <p>Respawning in: {respawnCountdown}s</p>
        </div>
      )}

      <Canvas
        shadows={{
          enabled: performanceSettings.shadowQuality !== "off",
          type: "pcfsoft", // Use PCF soft shadows for better quality/performance balance
          mapSize:
            QUALITY_VALUES.shadow[performanceSettings.shadowQuality].mapSize,
          autoUpdate: performanceLevel !== "low", // Only auto-update shadows on medium/high
          needsUpdate: true,
        }}
        dpr={[1, performanceLevel === "high" ? 2 : 1.5]}
        camera={{ fov: 75, position: [0, 2, 5] }}
        gl={{
          antialias: performanceSettings.antialiasing,
          alpha: false, // Disable alpha for better performance
          stencil: false, // Disable stencil for better performance
          depth: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#87CEEB"); // Set sky color for better performance than Sky component
        }}
        frameloop="demand" // Only render when needed for better performance
        onBeforeRender={() => {
          // Update FPS tracking on each frame
          updateFps();
        }}
      >
        <Physics gravity={[0, -9.81, 0]} interpolate={false} timeStep={1 / 60}>
          {process.env.NODE_ENV === "development" && <PhysicsDebug />}

          {isGameReady && !isRespawning && <PointerLockControls />}

          <Sky sunPosition={[100, 100, 20]} />
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />

          <Map
            redFlagCaptured={flagState.redFlagCaptured}
            blueFlagCaptured={flagState.blueFlagCaptured}
          />
          <Player
            key="localPlayer"
            position={getSpawnPositionForTeam(playerTeam || "Blue")}
            rotation={playerRef.current?.rotation || [0, 0, 0]}
            isLocalPlayer={true}
            name={playerName}
            team={playerTeam || "Blue"}
            onPositionUpdate={(position, rotation) => {
              updatePlayerPosition(position, rotation);
            }}
            onShoot={isRespawning ? () => {} : handleShoot}
            onReload={(action) => {
              console.log("Game received reload action:", action);
              if (action === "start") {
                console.log("Starting reload from Game component");
                setIsReloadInProgress(true);

                // Update the UI state for reload in progress
                setPlayerReloadState({
                  isReloading: true,
                  reloadProgress: 0,
                  currentBatch: 0,
                });
              } else if (action === "complete") {
                console.log("Completing reload from Game component");
                handleReloadComplete();

                // Update the UI state for reload complete
                setPlayerReloadState({
                  isReloading: false,
                  reloadProgress: 0,
                  currentBatch: 0,
                });
              } else if (action === "cancel") {
                console.log("Canceling reload from Game component");
                setIsReloadInProgress(false);

                // Update the UI state for reload canceled
                setPlayerReloadState({
                  isReloading: false,
                  reloadProgress: 0,
                  currentBatch: 0,
                });
              }
            }}
            onReplenish={handleReplenish}
            onFlagCapture={isRespawning ? () => {} : handleFlagCapture}
            onFlagReturn={isRespawning ? () => {} : handleFlagReturn}
            gameStats={{
              ...gameStats,
              team: playerTeam || gameStats.team || "Blue",
            }}
            debugMode={process.env.NODE_ENV === "development"}
            isCarryingFlag={playerFlagState.isCarryingFlag}
            carryingFlagTeam={playerFlagState.carryingFlagTeam}
            isReloading={playerReloadState.isReloading}
            reloadProgress={playerReloadState.reloadProgress}
            onPlayerState={setPlayerState}
            ref={playerRef}
            isRespawning={isRespawning}
            isShooting={isShooting}
          />

          {playerRef.current &&
            socket &&
            Object.entries(
              getPlayersToRender(
                players,
                playerRef.current.position || [0, 0, 0]
              )
            )
              .filter(([id]) => id !== socket.id)
              .map(([id, player]) => {
                // Calculate distance to determine detail level
                const playerPos = player.position || [0, 0, 0];
                const localPos = playerRef.current.position || [0, 0, 0];
                const dx = playerPos[0] - localPos[0];
                const dy = playerPos[1] - localPos[1];
                const dz = playerPos[2] - localPos[2];
                const distanceSquared = dx * dx + dy * dy + dz * dz;
                const useLowDetail =
                  distanceSquared >
                  getCurrentSettings().billboardDistance *
                    getCurrentSettings().billboardDistance;

                // Now return the Player component with all needed props
                return (
                  <Player
                    key={id}
                    isLocalPlayer={false}
                    position={player.position}
                    rotation={player.rotation}
                    name={player.name || `Player ${id.substring(0, 4)}`}
                    team={player.team}
                    useLowDetail={useLowDetail}
                    isCarryingFlag={
                      (flagState.redFlagCarrier === player.name &&
                        player.team === "Blue") ||
                      (flagState.blueFlagCarrier === player.name &&
                        player.team === "Red")
                    }
                    carryingFlagTeam={
                      flagState.redFlagCarrier === player.name
                        ? "Red"
                        : flagState.blueFlagCarrier === player.name
                        ? "Blue"
                        : null
                    }
                    isEliminated={player.is_eliminated || false}
                  />
                );
              })}

          {paintballs.map((paintball) => (
            <Paintball
              key={paintball.id}
              id={paintball.id}
              position={paintball.position}
              direction={paintball.direction}
              color={paintball.color}
              onHit={(id, hitInfo) => handlePaintballHit(id, hitInfo)}
            />
          ))}
        </Physics>
      </Canvas>

      {isGameReady && (
        <HUD
          stats={{
            ...gameStats,
            team: playerTeam || gameStats.team || "Blue", // Ensure team is available
          }}
          isReloading={playerReloadState.isReloading}
          reloadProgress={playerReloadState.reloadProgress}
          isReplenishing={playerReplenishState.isReplenishing}
          replenishProgress={playerReplenishState.replenishProgress}
          isNearCanisterCrate={playerReplenishState.isNearCanisterCrate}
          flagState={playerFlagState}
          performanceInfo={debugInfo}
          showPerformance={process.env.NODE_ENV === "development"}
          isRespawning={isRespawning}
          respawnCountdown={respawnCountdown}
        />
      )}

      <Chat messages={messages} onSendMessage={sendMessage} />

      {/* Performance statistics overlay */}
      <PerformanceStats visible={SHOW_PERFORMANCE_STATS} />

      {/* Kill Feed Display */}
      <div className={styles.killFeed}>
        {killFeed.map((msg) => (
          <div key={msg.id} className={styles.killFeedMessage}>
            {msg.text}
          </div>
        ))}
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className={styles.debugOverlay}>
          <h3>Debug Info</h3>
          <pre>
            {JSON.stringify(
              {
                isGameReady,
                playerCount: Object.keys(players).length,
                socketConnected: socket?.connected,
                ammo: gameStats.chamberAmmo + gameStats.canistersRemaining * 30,
                health: gameStats.health,
              },
              null,
              2
            )}
          </pre>

          <div className={styles.debugControls}>
            <h4>Debug Controls</h4>
            <button
              onClick={() => {
                console.log("Testing movement");
                const event = new KeyboardEvent("keydown", { code: "KeyW" });
                window.dispatchEvent(event);
                setTimeout(() => {
                  const upEvent = new KeyboardEvent("keyup", { code: "KeyW" });
                  window.dispatchEvent(upEvent);
                }, 1000);
              }}
            >
              Test Forward
            </button>
            <button
              onClick={() => {
                console.log("Testing jump");
                const event = new KeyboardEvent("keydown", { code: "Space" });
                window.dispatchEvent(event);
                setTimeout(() => {
                  const upEvent = new KeyboardEvent("keyup", { code: "Space" });
                  window.dispatchEvent(upEvent);
                }, 200);
              }}
            >
              Test Jump
            </button>
            <button
              onClick={() => {
                console.log("Testing shoot");
                const event = new MouseEvent("mousedown", { button: 0 });
                window.dispatchEvent(event);
                setTimeout(() => {
                  const upEvent = new MouseEvent("mouseup", { button: 0 });
                  window.dispatchEvent(upEvent);
                }, 200);
              }}
            >
              Test Shoot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
