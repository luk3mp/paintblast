import React, { memo, useMemo } from "react";
import styles from "../styles/HUD.module.css";

// Memoize the health display to prevent re-renders when other states change
const HealthDisplay = memo(({ health }) => {
  return (
    <div className={styles.healthBar}>
      <div className={styles.healthFill} style={{ width: `${health}%` }}></div>
    </div>
  );
});

// Memoize the chamber display
const ChamberDisplay = memo(({ chamberAmmo, chamberCapacity }) => {
  const chamberPercentage = (chamberAmmo / chamberCapacity) * 100;

  return (
    <div className={styles.chamber}>
      <div className={styles.chamberLabel}>CHAMBER</div>
      <div className={styles.chamberContainer}>
        <div
          className={styles.chamberFill}
          style={{ width: `${chamberPercentage}%` }}
        ></div>
        <span className={styles.chamberCount}>
          {chamberAmmo} / {chamberCapacity}
        </span>
      </div>
    </div>
  );
});

// Memoize the canister display
const CanisterDisplay = memo(({ canistersRemaining }) => {
  // Create array of canister states
  const canisterStates = useMemo(() => {
    return [
      canistersRemaining >= 1, // First canister
      canistersRemaining >= 2, // Second canister
    ];
  }, [canistersRemaining]);

  return (
    <div className={styles.canistersContainer}>
      <div className={styles.canistersLabel}>CANISTERS</div>
      <div className={styles.canisters}>
        {canisterStates.map((isFull, index) => (
          <div
            key={`canister-${index}`}
            className={`${styles.canister} ${
              isFull ? styles.canisterFull : styles.canisterEmpty
            }`}
          >
            <div className={styles.canisterGraphic}></div>
          </div>
        ))}
      </div>
    </div>
  );
});

// Memoize reload wheel
const ReloadWheel = memo(({ progress }) => {
  return (
    <div className={styles.reloadWheel}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r="35"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeOpacity="0.3"
        />
        <circle
          cx="40"
          cy="40"
          r="35"
          fill="none"
          stroke="#ffcc00"
          strokeWidth="8"
          strokeDasharray={`${2 * Math.PI * 35 * progress} ${
            2 * Math.PI * 35 * (1 - progress)
          }`}
          strokeDashoffset={2 * Math.PI * 35 * 0.25}
          transform="rotate(-90 40 40)"
        />
        <text
          x="40"
          y="45"
          textAnchor="middle"
          fill="#fff"
          fontSize="16"
          fontWeight="bold"
        >
          {Math.floor(progress * 100)}%
        </text>
      </svg>
    </div>
  );
});

// Memoize replenish wheel
const ReplenishWheel = memo(({ progress }) => {
  return (
    <div className={styles.reloadWheel}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r="35"
          fill="none"
          stroke="#000"
          strokeWidth="8"
          strokeOpacity="0.3"
        />
        <circle
          cx="40"
          cy="40"
          r="35"
          fill="none"
          stroke="#00cc00"
          strokeWidth="8"
          strokeDasharray={`${2 * Math.PI * 35 * progress} ${
            2 * Math.PI * 35 * (1 - progress)
          }`}
          strokeDashoffset={2 * Math.PI * 35 * 0.25}
          transform="rotate(-90 40 40)"
        />
        <text
          x="40"
          y="45"
          textAnchor="middle"
          fill="#fff"
          fontSize="16"
          fontWeight="bold"
        >
          {Math.floor(progress * 100)}%
        </text>
      </svg>
    </div>
  );
});

// Performance display component
const PerformanceDisplay = memo(({ fps, performanceLevel }) => {
  // Color based on FPS
  const fpsColor = fps >= 50 ? "#00cc00" : fps >= 30 ? "#ffcc00" : "#ff0000";

  return (
    <div className={styles.performanceDisplay}>
      <div className={styles.fpsCounter} style={{ color: fpsColor }}>
        {fps} FPS
      </div>
      <div className={styles.performanceLevel}>
        Quality: {performanceLevel.toUpperCase()}
      </div>
    </div>
  );
});

// Add TeamDisplay component
const TeamDisplay = memo(({ team }) => {
  const teamColor = team === "Red" ? "#ff0000" : "#0066ff";

  console.log("Rendering TeamDisplay with team:", team);

  return (
    <div className={styles.teamDisplay} style={{ backgroundColor: teamColor }}>
      Team {team}
    </div>
  );
});

// Add FlagStatusDisplay component
const FlagStatusDisplay = memo(({ team, isCarryingFlag, carryingFlagTeam }) => {
  return (
    <div className={styles.flagStatus}>
      {isCarryingFlag && (
        <div
          className={styles.carryingFlag}
          style={{ color: carryingFlagTeam === "Red" ? "#ff0000" : "#0066ff" }}
        >
          CARRYING {carryingFlagTeam.toUpperCase()} FLAG
        </div>
      )}
    </div>
  );
});

// Main HUD component with React.memo
const HUD = memo(
  ({
    stats,
    isReloading = false,
    reloadProgress = 0,
    isReplenishing = false,
    replenishProgress = 0,
    isNearCanisterCrate = false,
    flagState = {
      isCarryingFlag: false,
      carryingFlagTeam: null,
      nearFlagTeam: null,
      nearHomeBase: false,
    },
    performanceInfo = null,
    showPerformance = false,
  }) => {
    // Chamber holds 30 bullets
    const CHAMBER_CAPACITY = 30;

    // Debug team info
    console.log("HUD received stats:", stats);

    // Ensure chamber ammo is a number
    const chamberAmmo =
      typeof stats.chamberAmmo === "number" ? stats.chamberAmmo : 0;

    // Get number of canisters
    const remainingCanisters =
      typeof stats.canistersRemaining === "number"
        ? stats.canistersRemaining
        : 0;

    // Calculate total ammo for display
    const totalAmmo = chamberAmmo + remainingCanisters * CHAMBER_CAPACITY;

    return (
      <div className={styles.hud}>
        <div className={styles.bottomRight}>
          <div className={styles.ammoDisplay}>
            <div className={styles.magazine}>
              <ChamberDisplay
                chamberAmmo={chamberAmmo}
                chamberCapacity={CHAMBER_CAPACITY}
              />
              <CanisterDisplay canistersRemaining={remainingCanisters} />
            </div>
          </div>
        </div>

        <div className={styles.crosshair}>+</div>

        <div className={styles.bottomLeft}>
          <div className={styles.health}>
            <HealthDisplay health={stats.health} />
            <div className={styles.healthText}>{stats.health}</div>
          </div>
        </div>

        <div className={styles.topRight}>
          {/* Team display - Show even if stats.team is missing */}
          {stats.team ? (
            <TeamDisplay team={stats.team} />
          ) : (
            // Backup method to show team indicator
            <div
              className={styles.teamDisplay}
              style={{ backgroundColor: "#888888" }}
            >
              Team Unknown
            </div>
          )}

          <div className={styles.score}>
            {stats.redScore} - {stats.blueScore}
          </div>

          {/* Performance display */}
          {showPerformance && performanceInfo && (
            <PerformanceDisplay
              fps={performanceInfo.fps}
              performanceLevel={performanceInfo.performanceLevel}
            />
          )}

          {/* Flag status display */}
          {flagState.isCarryingFlag && (
            <FlagStatusDisplay
              team={stats.team}
              isCarryingFlag={flagState.isCarryingFlag}
              carryingFlagTeam={flagState.carryingFlagTeam}
            />
          )}
        </div>

        {/* Flag capture prompt when near enemy flag */}
        {flagState.nearFlagTeam &&
          flagState.nearFlagTeam !== stats.team &&
          !flagState.isCarryingFlag && (
            <div className={styles.flagCapturePrompt}>
              PRESS F TO CAPTURE FLAG
            </div>
          )}

        {/* Flag return prompt when carrying flag and at home base */}
        {flagState.isCarryingFlag && flagState.nearHomeBase && (
          <div className={styles.flagReturnPrompt}>PRESS F TO RETURN FLAG</div>
        )}

        {/* Replenish prompt when near crate and missing canisters */}
        {isNearCanisterCrate &&
          remainingCanisters < 2 &&
          !isReplenishing &&
          !isReloading && (
            <div className={styles.replenishPrompt}>
              TAP R TO REPLENISH CANISTERS
            </div>
          )}

        {/* Reload prompt when chamber is empty and canisters remain */}
        {chamberAmmo === 0 &&
          remainingCanisters > 0 &&
          !isReloading &&
          !isReplenishing &&
          !isNearCanisterCrate && (
            <div className={styles.reloadPrompt}>TAP R TO RELOAD</div>
          )}

        {/* Empty ammo prompt when both chamber and canisters are empty */}
        {chamberAmmo === 0 &&
          remainingCanisters === 0 &&
          !isReloading &&
          !isReplenishing && (
            <div className={styles.emptyPrompt}>OUT OF AMMO!</div>
          )}

        {/* Reload progress wheel */}
        {isReloading && reloadProgress > 0 && reloadProgress < 1 && (
          <ReloadWheel progress={reloadProgress} />
        )}

        {/* Replenish progress wheel */}
        {isReplenishing && replenishProgress > 0 && replenishProgress < 1 && (
          <ReplenishWheel progress={replenishProgress} />
        )}
      </div>
    );
  }
);

// Add displayName for debugging purposes
HUD.displayName = "HUD";
HealthDisplay.displayName = "HealthDisplay";
ChamberDisplay.displayName = "ChamberDisplay";
CanisterDisplay.displayName = "CanisterDisplay";
ReloadWheel.displayName = "ReloadWheel";
ReplenishWheel.displayName = "ReplenishWheel";
PerformanceDisplay.displayName = "PerformanceDisplay";
TeamDisplay.displayName = "TeamDisplay";
FlagStatusDisplay.displayName = "FlagStatusDisplay";

export default HUD;
