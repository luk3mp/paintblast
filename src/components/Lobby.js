import { useState, useEffect } from "react";
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

  // Initialize socket connection on component mount
  useEffect(() => {
    if (multiplayerEnabled) {
      // Connect to the socket server if multiplayer is enabled
      connectSocket({ multiplayer: true });

      // Request server status immediately
      const socket = getSocket();
      if (socket) {
        socket.emit("requestServerStatus");
      }
    }
  }, []);

  // Listen for server status updates and connection state changes
  useEffect(() => {
    // Handle server status updates
    const removeStatusListener = addEventListener(
      EVENTS.SERVER_STATUS_UPDATE,
      (data) => {
        setServerStats(data);
        setIsServerUp(true);
      }
    );

    // Handle server status change events
    const removeServerStatusChangeListener = addEventListener(
      EVENTS.SERVER_STATUS_CHANGE,
      (isOnline) => {
        setIsServerUp(isOnline);
      }
    );

    // Handle connection state changes
    const removeConnectionListener = addEventListener(
      EVENTS.CONNECTION_STATE_CHANGE,
      (data) => {
        setConnectionState(data.state);

        // If connection established, remove connecting state
        if (data.state === "connected") {
          setIsConnecting(false);
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
  }, [multiplayerEnabled]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Please enter a name");
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
              <div className={styles.playerCount}>
                <span>
                  Players: {serverStats.currentPlayers}/{serverStats.maxPlayers}
                </span>
                {serverStats.queueLength > 0 && (
                  <span className={styles.queueInfo}>
                    ({serverStats.queueLength} in queue)
                  </span>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            className={styles.button}
            disabled={isConnecting}
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
