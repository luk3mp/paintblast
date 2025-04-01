import { useState, useEffect, useCallback } from "react";
import styles from "../styles/Lobby.module.css";
import {
  getServerStatus,
  connectSocket,
  isMultiplayer,
  getConnectionState,
  isServerOnline,
  getSocket,
} from "../lib/socket";
import { IS_MULTIPLAYER, SERVER_URL } from "../lib/config";
import { EVENTS, addEventListener } from "../lib/events";

export default function Lobby({ onJoinGame }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [serverStats, setServerStats] = useState(getServerStatus());
  const [isConnecting, setIsConnecting] = useState(false);
  const [multiplayerEnabled, setMultiplayerEnabled] = useState(IS_MULTIPLAYER);
  const [connectionState, setConnectionState] = useState(getConnectionState());
  const [isServerUp, setIsServerUp] = useState(isServerOnline());
  const [connectionAttempts, setConnectionAttempts] = useState(0);

  // Memoized function to connect to server
  const connectToServer = useCallback(() => {
    setIsConnecting(true);
    setError("");

    try {
      // Connect to the socket server
      const socket = connectSocket({ multiplayer: true });

      if (socket) {
        // Request server status immediately
        socket.emit("requestServerStatus");

        // Start a timeout to check connection status
        const statusCheckTimeout = setTimeout(() => {
          if (!isServerOnline()) {
            console.log("Server connection timeout - status still offline");
            setIsServerUp(false);
            // Keep connecting state for visual feedback
            setIsConnecting(false);
          }
        }, 5000);

        return () => clearTimeout(statusCheckTimeout);
      }
    } catch (err) {
      console.error("Error connecting to server:", err);
      setError("Connection error. Please try again.");
      setIsConnecting(false);
    }
  }, []);

  // Initialize socket connection on component mount
  useEffect(() => {
    if (multiplayerEnabled) {
      connectToServer();
    }

    // Cleanup function
    return () => {
      // Component cleanup can go here if needed
    };
  }, [multiplayerEnabled, connectToServer]);

  // Listen for server status updates and connection state changes
  useEffect(() => {
    // Handle server status updates
    const removeStatusListener = addEventListener(
      EVENTS.SERVER_STATUS_UPDATE,
      (data) => {
        setServerStats(data);
        setIsServerUp(true);
        setIsConnecting(false);
      }
    );

    // Handle server status change events
    const removeServerStatusChangeListener = addEventListener(
      EVENTS.SERVER_STATUS_CHANGE,
      (isOnline) => {
        console.log("Server status changed:", isOnline);
        setIsServerUp(isOnline);

        if (!isOnline && multiplayerEnabled) {
          // If server went offline and we're in multiplayer mode
          setConnectionAttempts((prev) => prev + 1);

          // Only show connecting indicator if we're actively trying to reconnect
          if (connectionState === "connecting") {
            setIsConnecting(true);
          }
        }
      }
    );

    // Handle connection state changes
    const removeConnectionListener = addEventListener(
      EVENTS.CONNECTION_STATE_CHANGE,
      (data) => {
        console.log("Connection state changed:", data.state);
        setConnectionState(data.state);

        // If connection established, remove connecting state
        if (data.state === "connected") {
          setIsConnecting(false);
        } else if (data.state === "connecting") {
          setIsConnecting(true);
        }

        // If connection failed, show error and switch to single-player
        if (data.state === "error" && multiplayerEnabled) {
          setError(
            "Could not connect to server. Playing in single-player mode."
          );
          setMultiplayerEnabled(false);
          setIsConnecting(false);
        }
      }
    );

    return () => {
      removeStatusListener();
      removeConnectionListener();
      removeServerStatusChangeListener();
    };
  }, [multiplayerEnabled, connectionState]);

  // Effect to retry connection when it fails
  useEffect(() => {
    if (
      connectionAttempts > 0 &&
      connectionAttempts < 3 &&
      multiplayerEnabled &&
      !isServerUp
    ) {
      // Wait a bit, then try to reconnect
      const reconnectTimer = setTimeout(() => {
        console.log(`Reconnection attempt ${connectionAttempts}...`);
        connectToServer();
      }, 3000); // Wait 3 seconds between attempts

      return () => clearTimeout(reconnectTimer);
    }
  }, [connectionAttempts, multiplayerEnabled, isServerUp, connectToServer]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    // Check connection status before proceeding
    if (multiplayerEnabled && !isServerUp) {
      setError(
        "Server is currently offline. Try single-player mode or wait for server to come back online."
      );
      return;
    }

    // Limit name length
    const trimmedName = name.trim().substring(0, 16);

    // Join game with name and multiplayer preference
    onJoinGame(trimmedName, multiplayerEnabled);
  };

  const toggleMultiplayer = () => {
    if (isConnecting) return;

    if (!multiplayerEnabled) {
      // Switching to multiplayer
      setMultiplayerEnabled(true);
      // Reset connection attempts when manually toggling
      setConnectionAttempts(0);
    } else {
      // Switching to single-player
      setMultiplayerEnabled(false);
    }
  };

  return (
    <div className={styles.lobby}>
      <div className={styles.container}>
        <h1 className={styles.title}>PaintBlast</h1>
        <h2 className={styles.subtitle}>Multiplayer Paintball</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder="Enter your callsign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.input}
            maxLength={16}
          />

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.modeToggle}>
            <label className={styles.toggleLabel}>
              <span>Multiplayer</span>
              <div
                className={`${styles.toggle} ${
                  multiplayerEnabled ? styles.active : ""
                } ${isConnecting ? styles.connecting : ""}`}
                onClick={toggleMultiplayer}
              >
                <div className={styles.toggleHandle}></div>
              </div>
              <span>
                {isConnecting
                  ? "Connecting..."
                  : multiplayerEnabled
                  ? "Online"
                  : "Offline"}
              </span>
            </label>
          </div>

          {multiplayerEnabled && (
            <div className={styles.serverStatus}>
              <div className={styles.statusIndicator}>
                <div
                  className={`${styles.indicator} ${
                    isServerUp ? styles.connected : styles.disconnected
                  }`}
                ></div>
                <span>Server Status: {isServerUp ? "Online" : "Offline"}</span>
              </div>
              {isServerUp && (
                <div className={styles.playerCount}>
                  <span>
                    Players: {serverStats.currentPlayers}/
                    {serverStats.maxPlayers}
                  </span>
                  {serverStats.queueLength > 0 && (
                    <span className={styles.queueInfo}>
                      ({serverStats.queueLength} in queue)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className={styles.button}
            disabled={isConnecting || (multiplayerEnabled && !isServerUp)}
          >
            {multiplayerEnabled ? "Join Multiplayer" : "Play Solo"}
          </button>
        </form>

        <div className={styles.info}>
          <h3>How to Play</h3>
          <ul>
            <li>WASD to move</li>
            <li>Mouse to aim</li>
            <li>Left click to shoot</li>
            <li>R to reload</li>
            <li>Shift to sprint</li>
            <li>F to capture the flag</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
