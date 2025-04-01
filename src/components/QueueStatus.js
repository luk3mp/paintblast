import { useEffect, useState } from "react";
import styles from "../styles/QueueStatus.module.css";
import {
  getQueuePosition,
  getEstimatedWaitTime,
  getServerStatus,
} from "../lib/socket";
import { EVENTS, addEventListener } from "../lib/events";

/**
 * QueueStatus component displays a waiting screen when a player is in queue
 * @param {Object} props - Component props
 * @param {Function} props.onCancel - Function to call when player cancels waiting
 * @param {Function} props.onJoinGame - Function to call when player can join the game
 */
export default function QueueStatus({ onCancel, onJoinGame }) {
  const [position, setPosition] = useState(getQueuePosition());
  const [waitTime, setWaitTime] = useState(getEstimatedWaitTime(position));
  const [serverStats, setServerStats] = useState(getServerStatus());
  const [dots, setDots] = useState(".");

  // Update animated dots for waiting indicator
  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prevDots) => {
        if (prevDots.length >= 3) return ".";
        return prevDots + ".";
      });
    }, 500);

    return () => clearInterval(dotsInterval);
  }, []);

  // Listen for queue updates
  useEffect(() => {
    // Handle queue updates
    const removeQueueListener = addEventListener(
      EVENTS.QUEUE_UPDATE,
      (data) => {
        setPosition(data.position);
        setWaitTime(
          data.estimatedWaitTime
            ? data.estimatedWaitTime
            : getEstimatedWaitTime(data.position)
        );
      }
    );

    // Handle server status updates
    const removeStatusListener = addEventListener(
      EVENTS.SERVER_STATUS_UPDATE,
      (data) => {
        setServerStats(data);
      }
    );

    // Handle queue ready
    const removeReadyListener = addEventListener(EVENTS.QUEUE_READY, () => {
      onJoinGame();
    });

    // Clean up
    return () => {
      removeQueueListener();
      removeStatusListener();
      removeReadyListener();
    };
  }, [onJoinGame]);

  // If position is 0, the player is ready to join
  if (position === 0) {
    return (
      <div className={styles.queueStatus}>
        <div className={styles.container}>
          <h1 className={styles.title}>Ready to Join!</h1>
          <p className={styles.message}>
            A spot just opened up! Joining game now...
          </p>
          <div className={styles.progressContainer}>
            <div className={styles.progress} style={{ width: "100%" }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.queueStatus}>
      <div className={styles.container}>
        <h1 className={styles.title}>Waiting in Queue</h1>
        <p className={styles.position}>Position: {position}</p>
        <p className={styles.message}>
          The server is currently full. You&apos;ll be automatically joined when
          a spot opens up.
        </p>
        <p className={styles.waitTime}>
          Estimated wait time: {waitTime || "Calculating" + dots}
        </p>

        <div className={styles.serverInfo}>
          <p>
            Players: {serverStats.currentPlayers}/{serverStats.maxPlayers}
          </p>
          <p>People waiting: {serverStats.queueLength}</p>
        </div>

        <div className={styles.progressContainer}>
          <div
            className={styles.progress}
            style={{
              width: `${
                100 - (position / (serverStats.queueLength + 1)) * 100
              }%`,
            }}
          ></div>
        </div>

        <button className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
