import { useState, useEffect } from "react";
import styles from "../styles/PerformanceStats.module.css";
import {
  getFPS,
  getAverageFPS,
  getPerformanceLevel,
  getCurrentSettings,
  getNetworkStats,
} from "../lib/performance";
import { SHOW_PERFORMANCE_STATS, NETWORK_STATS_ENABLED } from "../lib/config";

/**
 * Component to display performance statistics
 * @param {Object} props
 * @param {boolean} props.visible Whether the component should be visible
 * @returns {JSX.Element}
 */
export default function PerformanceStats({ visible = SHOW_PERFORMANCE_STATS }) {
  const [stats, setStats] = useState({
    fps: 60,
    avgFps: 60,
    performanceLevel: "medium",
    networkStats: {},
    expanded: false,
  });

  useEffect(() => {
    if (!visible) return;

    // Update stats every 500ms
    const intervalId = setInterval(() => {
      setStats({
        fps: Math.round(getFPS()),
        avgFps: Math.round(getAverageFPS()),
        performanceLevel: getPerformanceLevel(),
        settings: getCurrentSettings(),
        networkStats: NETWORK_STATS_ENABLED ? getNetworkStats() : {},
        expanded: stats.expanded,
      });
    }, 500);

    return () => clearInterval(intervalId);
  }, [visible, stats.expanded]);

  if (!visible) return null;

  // Set color based on FPS
  const getFpsColor = (fps) => {
    if (fps >= 55) return styles.good;
    if (fps >= 30) return styles.medium;
    return styles.poor;
  };

  const toggleExpanded = () => {
    setStats((prevStats) => ({
      ...prevStats,
      expanded: !prevStats.expanded,
    }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.fpsCounter} onClick={toggleExpanded}>
        <span className={getFpsColor(stats.fps)}>{stats.fps} FPS</span>
      </div>

      {stats.expanded && (
        <div className={styles.expandedStats}>
          <div className={styles.section}>
            <h3>Performance</h3>
            <div className={styles.statRow}>
              <span>Average FPS:</span>
              <span className={getFpsColor(stats.avgFps)}>{stats.avgFps}</span>
            </div>
            <div className={styles.statRow}>
              <span>Quality Level:</span>
              <span>{stats.performanceLevel}</span>
            </div>
            {stats.settings && (
              <>
                <div className={styles.statRow}>
                  <span>Max Paintballs:</span>
                  <span>{stats.settings.maxPaintballs}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Max Visible Players:</span>
                  <span>{stats.settings.maxVisiblePlayers}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Shadow Quality:</span>
                  <span>{stats.settings.shadowQuality}</span>
                </div>
              </>
            )}
          </div>

          {NETWORK_STATS_ENABLED && stats.networkStats && (
            <div className={styles.section}>
              <h3>Network</h3>
              <div className={styles.statRow}>
                <span>Sent:</span>
                <span>
                  {(stats.networkStats.bytesSentPerSecond / 1024).toFixed(1)}{" "}
                  KB/s
                </span>
              </div>
              <div className={styles.statRow}>
                <span>Received:</span>
                <span>
                  {(stats.networkStats.bytesReceivedPerSecond / 1024).toFixed(
                    1
                  )}{" "}
                  KB/s
                </span>
              </div>
              <div className={styles.statRow}>
                <span>Messages Out:</span>
                <span>{stats.networkStats.messagesSentPerSecond}/s</span>
              </div>
              <div className={styles.statRow}>
                <span>Messages In:</span>
                <span>{stats.networkStats.messagesReceivedPerSecond}/s</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
