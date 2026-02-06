import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Quaternion, Euler } from "three";
import { RigidBody, CapsuleCollider, useRapier } from "@react-three/rapier";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import CharacterModel from "./models/CharacterModel";
import FirstPersonGun from "./models/FirstPersonGun";

// Movement constants
const SPEED = 500.0; // Force-based movement needs higher values
const SPRINT_SPEED = 750.0; // Sprint speed with shift
const JUMP_FORCE = 25.0; // Increased from 15.0 for even higher jumps
const MAX_JUMPS = 1; // Only allow one jump before touching ground
const JUMP_COOLDOWN = 500; // ms between jumps

// Add a strict jump cooldown system
const STRICT_JUMP_COOLDOWN = 800; // ms - longer cooldown to prevent spam

// At the top with the movement constants, add performance optimization constants
const POSITION_UPDATE_RATE = 30; // Only update position every ~33ms
const LOG_RATE = 500; // Only log data every 500ms
const RAY_COUNT = 3; // Reduce ray count from 5 to 3 for ground detection

const Player = forwardRef(
  (
    {
      isLocalPlayer = false,
      position = [0, 2, 0], // Starting position (y=2 means 2 units above ground)
      rotation = [0, 0, 0],
      name = "Player",
      team = "Red", // Default team assignment
      onPositionUpdate = () => {},
      onShoot = () => {},
      onReload = () => {},
      onReplenish = () => {}, // Add this prop for canister replenishment
      onFlagCapture = () => {}, // Add this prop for flag capture
      onFlagReturn = () => {}, // Add this prop for flag return
      debugMode = false,
      gameStats = null,
      onPlayerState = () => {},
      useLowDetail = false,
      isCarryingFlag = false,
      carryingFlagTeam = null,
      isReloading = false,
      reloadProgress = 0,
      isShooting = false, // Use this prop from parent instead of local state
      isRespawning = false, // Add isRespawning prop
      isCrouching = false, // Remote crouch state
    },
    ref
  ) => {
    const playerRef = useRef();
    const fpGunRef = useRef(); // First-person gun ref (barrel tip access)
    const { camera } = useThree();
    const { rapier, world } = useRapier();

    // Add a ref to track if position has been set before
    const positionHasBeenSet = useRef(false);

    // Expose the playerRef to the parent component with a completely disabled setTranslation after first use
    useImperativeHandle(ref, () => ({
      setTranslation: (position) => {
        if (playerRef.current) {
          // Allow position setting for team-based spawn positioning
          playerRef.current.setTranslation(position, true);
          console.log("*** POSITION SET TO:", position);
          positionHasBeenSet.current = true;

          // Also store in our stable position reference
          if (position.x !== undefined) {
            stablePosition.current = [position.x, position.y, position.z];
          }
        }
      },
      getRef: () => playerRef.current,
    }));

    // For remote players — smooth interpolation
    const [playerPosition, setPlayerPosition] = useState(position);
    const [playerRotation, setPlayerRotation] = useState(rotation);
    const targetPosition = useRef(
      Array.isArray(position) ? [...position] : [0, 2, 0]
    );
    const currentPosition = useRef(
      Array.isArray(position) ? [...position] : [0, 2, 0]
    );
    const targetRotation = useRef(
      Array.isArray(rotation) ? [...rotation] : [0, 0, 0]
    );
    const currentRotation = useRef(
      Array.isArray(rotation) ? [...rotation] : [0, 0, 0]
    );

    // Simple keyboard state tracking
    const [keys, setKeys] = useState({
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      crouch: false,
    });

    // Player properties
    const playerHeight = 1.7; // Total height of player
    const isOnGround = useRef(true);
    const jumpCooldown = useRef(false);

    // Add these refs to track jump state
    const jumpCount = useRef(0);
    const lastJumpTime = useRef(Date.now()); // Initialize to current time so spawn check works
    const maxJumpHeight = useRef(0);
    const jumpStartY = useRef(0);
    const isJumping = useRef(false);

    // New ammo system with 3 pouches
    const [ammo, setAmmo] = useState(30); // Current pouch
    const [pouches, setPouches] = useState([30, 30, 30]); // 3 pouches of 30 each
    const [currentPouch, setCurrentPouch] = useState(0);
    const [isRefilling, setIsRefilling] = useState(false);
    const [refillProgress, setRefillProgress] = useState(0);

    const REFILL_TIME = 15; // seconds
    const MAX_AMMO_PER_POUCH = 30;
    const MAX_POUCHES = 3;

    // Keep these state declarations for backward compatibility
    // but use the props when available instead
    const [isReloadingLocal, setIsReloadingLocal] = useState(false);
    const [reloadProgressLocal, setReloadProgressLocal] = useState(0);
    const [isShooting_internal, setIsShooting_internal] = useState(false);

    // Use the prop values if provided, otherwise use local state
    const effectiveIsReloading = isReloading || isReloadingLocal;
    const effectiveReloadProgress = reloadProgress || reloadProgressLocal;
    const effectiveIsShooting = isShooting || isShooting_internal;

    // Add this comment explaining character models integration
    /**
     * Character Model Integration
     *
     * This Player component now uses two specialized models:
     * 1. FirstPersonGun - For the local player's first-person view
     * 2. CharacterModel - For all other players' third-person view
     *
     * The CharacterModel component handles team-colored visuals and displays
     * the player's name tag, while FirstPersonGun provides an immersive
     * first-person experience with appropriate animations.
     */

    // Add a constant for fire rate if it doesn't exist
    const FIRE_RATE = 150; // ms between shots
    const RELOAD_TIME = 5000; // 5 seconds to reload
    const MAGAZINE_CAPACITY = 30;

    // Add these refs if they don't exist
    const lastShotTime = useRef(0);
    const reloadStartTime = useRef(Date.now());
    const hasTriggeredReload = useRef(false);
    const reloading = useRef(false);

    const {
      forward: moveForward,
      backward: moveBackward,
      left: moveLeft,
      right: moveRight,
      jump: jumpInput,
      shoot: shootInput,
      reload: reloadInput,
      refill: refillInput,
      capture: captureInput,
    } = useKeyboardControls();

    // Add these states and constants for the reload system
    const reloadIntervalRef = useRef(null);

    // Add a function to handle reload completion
    const onReloadComplete = useRef(null);

    // Add canister replenish mechanic to Player component

    // Add these states for the replenish system
    const [isNearCanisterCrate, setIsNearCanisterCrate] = useState(false);
    const [isReplenishing, setIsReplenishing] = useState(false);
    const [replenishProgress, setReplenishProgress] = useState(0);
    const [replenishStartTime, setReplenishStartTime] = useState(null);
    const REPLENISH_TIME = 10000; // 10 seconds to replenish canisters

    // Performance optimization timers
    const lastPositionUpdateTime = useRef(0);
    const lastLogTime = useRef(0);
    const frameCount = useRef(0);

    // Add a first-time spawn check - but disable it completely as it's causing respawn issues
    const hasSpawned = useRef(true); // Set to true to disable the auto-respawn logic

    // Add a ref to track if rigid body position has been initialized
    const rigidBodyInitialized = useRef(false);

    // Add a stable position ref to prevent position changes
    const stablePosition = useRef(position);

    // Disable all further collision detection after initial placement
    const disableCollisionHandling = useRef(false);

    // Add flag capture state
    const [nearFlagTeam, setNearFlagTeam] = useState(null);
    const [nearHomeBase, setNearHomeBase] = useState(false);

    // Add this ref at the top with other refs
    const lastCaptureState = useRef(false);

    // Add a function to start replenishing
    const startReplenish = () => {
      if (isReplenishing || effectiveIsReloading || !gameStats) return;

      // Only allow replenish if missing canisters
      // if (gameStats.canistersRemaining >= 2) {
      //   console.log("Canisters already full!");
      //   return;
      // }

      console.log("Starting canister replenish...");
      setIsReplenishing(true);
      setReplenishStartTime(Date.now());
      setReplenishProgress(0);

      // Notify UI about replenish status
      if (onPlayerState) {
        onPlayerState({
          isReplenishing: true,
          replenishProgress: 0,
        });
      }
    };

    // Add a function to finish replenishing
    const finishReplenish = () => {
      if (!gameStats || !isReplenishing) return;

      console.log("Canister replenish complete");
      setIsReplenishing(false);
      setReplenishProgress(0);

      // Notify Game component about the replenish completion
      if (onReplenish) {
        onReplenish();
      }

      // Notify UI about replenish status
      if (onPlayerState) {
        onPlayerState({
          isReplenishing: false,
          replenishProgress: 0,
        });
      }
    };

    // Add a function to cancel replenishing
    const cancelReplenish = () => {
      if (!isReplenishing) return;

      console.log("Canister replenish canceled");
      setIsReplenishing(false);
      setReplenishProgress(0);

      // Notify UI about replenish status
      if (onPlayerState) {
        onPlayerState({
          isReplenishing: false,
          replenishProgress: 0,
        });
      }
    };

    useEffect(() => {
      if (!isLocalPlayer) {
        setPlayerPosition({
          x: position[0],
          y: position[1],
          z: position[2],
        });
        setPlayerRotation(rotation);
      }
    }, [isLocalPlayer, position, rotation]);

    // Add event listener registration for keyboard and mouse events if local player
    useEffect(() => {
      if (!isLocalPlayer) return;

      // Add debug logging to see if key events are being captured
      const handleKeyDown = (e) => {
        console.log("Key down:", e.code);
        switch (e.code) {
          case "KeyW":
          case "ArrowUp":
            setKeys((prev) => ({ ...prev, forward: true }));
            break;
          case "KeyS":
          case "ArrowDown":
            setKeys((prev) => ({ ...prev, backward: true }));
            break;
          case "KeyA":
          case "ArrowLeft":
            setKeys((prev) => ({ ...prev, left: true }));
            break;
          case "KeyD":
          case "ArrowRight":
            setKeys((prev) => ({ ...prev, right: true }));
            break;
          case "Space":
            setKeys((prev) => ({ ...prev, jump: true }));
            break;
          case "ShiftLeft":
            setKeys((prev) => ({ ...prev, sprint: true }));
            break;
          case "ControlLeft":
          case "KeyC":
            setKeys((prev) => ({ ...prev, crouch: true }));
            break;
          case "KeyR":
            // R key is for reload - use the keyboard controls hook
            break;
          case "KeyF":
            // F key is for flag capture - use the keyboard controls hook
            break;
          default:
            break;
        }
      };

      const handleKeyUp = (e) => {
        switch (e.code) {
          case "KeyW":
          case "ArrowUp":
            setKeys((prev) => ({ ...prev, forward: false }));
            break;
          case "KeyS":
          case "ArrowDown":
            setKeys((prev) => ({ ...prev, backward: false }));
            break;
          case "KeyA":
          case "ArrowLeft":
            setKeys((prev) => ({ ...prev, left: false }));
            break;
          case "KeyD":
          case "ArrowRight":
            setKeys((prev) => ({ ...prev, right: false }));
            break;
          case "Space":
            setKeys((prev) => ({ ...prev, jump: false }));
            break;
          case "ShiftLeft":
            setKeys((prev) => ({ ...prev, sprint: false }));
            break;
          case "ControlLeft":
          case "KeyC":
            setKeys((prev) => ({ ...prev, crouch: false }));
            break;
          default:
            break;
        }
      };

      const handleMouseDown = () => {
        if (document.pointerLockElement) {
          // Set the internal shooting state
          setIsShooting_internal(true);

          // Call shoot directly to handle immediate shooting
          // The useFrame loop will handle continuous shooting
          if (!effectiveIsReloading && ammoAvailable()) {
            // Use try-catch to handle any errors during shooting
            try {
              shoot();
            } catch (error) {
              console.error("Error during shooting:", error);
            }
          }
        }
      };

      const handleMouseUp = () => {
        setIsShooting_internal(false);
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      document.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        document.removeEventListener("mousedown", handleMouseDown);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, [
      isLocalPlayer,
      onReload,
      onShoot,
      onFlagCapture,
      onFlagReturn,
      nearFlagTeam,
      isCarryingFlag,
      carryingFlagTeam,
      nearHomeBase,
      team,
    ]);

    // Optimize ground detection with fewer rays
    const checkOnGround = () => {
      if (!playerRef.current || !world) return false;

      // Get current position
      const origin = playerRef.current.translation();

      // Cast fewer rays to optimize performance - 3 rays instead of 5
      const rayOrigins = [
        { x: origin.x, y: origin.y + 0.85, z: origin.z }, // Center
        { x: origin.x + 0.3, y: origin.y + 0.85, z: origin.z }, // Right
        { x: origin.x - 0.3, y: origin.y + 0.85, z: origin.z }, // Left
      ];

      const direction = { x: 0, y: -1, z: 0 };
      const rayLength = 1.1;

      // Check if any ray hits the ground
      for (const rayOrigin of rayOrigins) {
        const ray = new rapier.Ray(rayOrigin, direction);
        const hit = world.castRay(ray, rayLength, true);
        if (hit !== null) {
          return true;
        }
      }

      return false;
    };

    // For remote players: update target position/rotation when props change
    useEffect(() => {
      if (!isLocalPlayer && Array.isArray(position)) {
        targetPosition.current = [...position];
      }
    }, [isLocalPlayer, position]);

    useEffect(() => {
      if (!isLocalPlayer && Array.isArray(rotation)) {
        targetRotation.current = [...rotation];
      }
    }, [isLocalPlayer, rotation]);

    // Update useFrame to be more efficient
    useFrame((state, delta) => {
      // Increment frame counter
      frameCount.current++;

      // Remote player smooth interpolation
      if (!isLocalPlayer && playerRef.current) {
        const lerpSpeed = Math.min(1, delta * 12); // Smooth interpolation

        // --- Position lerp ---
        const tp = targetPosition.current;
        const cp = currentPosition.current;
        cp[0] += (tp[0] - cp[0]) * lerpSpeed;
        cp[1] += (tp[1] - cp[1]) * lerpSpeed;
        cp[2] += (tp[2] - cp[2]) * lerpSpeed;

        // --- Rotation lerp (shortest-path angular interpolation) ---
        // The sender computes yaw via atan2(forward.x, forward.z) which
        // directly maps to model rotation.y (no offset needed).
        const targetYaw = targetRotation.current[1];
        let currentYaw = currentRotation.current[1];

        // Compute shortest angular difference (wraps around ±π)
        let diff = targetYaw - currentYaw;
        diff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;

        currentYaw += diff * lerpSpeed;
        currentRotation.current[1] = currentYaw;

        playerRef.current.position.set(cp[0], cp[1], cp[2]);
        playerRef.current.rotation.set(0, currentYaw, 0);
      }

      if (isLocalPlayer && playerRef.current) {
        const now = Date.now();

        // DISABLED: Center detection respawn logic removed to prevent continuous respawning

        // Check if player is on ground, but not every frame
        if (frameCount.current % 2 === 0) {
          isOnGround.current = checkOnGround();
        }

        // Get current position from the rigid body - safely handle the case
        // where playerRef.current might not have translation method
        let position;
        try {
          // Try to get position from RigidBody if available
          if (typeof playerRef.current.translation === "function") {
            position = playerRef.current.translation();
          } else {
            // Fall back to playerPosition state
            position = {
              x: playerPosition.x,
              y: playerPosition.y,
              z: playerPosition.z,
            };
          }
        } catch (error) {
          console.error("Error getting player position:", error);
          // Fall back to playerPosition state
          position = {
            x: playerPosition.x,
            y: playerPosition.y,
            z: playerPosition.z,
          };
        }

        // Throttle position updates to server/other players
        if (now - lastPositionUpdateTime.current >= POSITION_UPDATE_RATE) {
          // Update player position state
          setPlayerPosition({
            x: position.x,
            y: position.y,
            z: position.z,
          });

          // Compute yaw from camera's actual forward vector (Euler-order independent)
          // Camera faces -Z, model faces +Z, so add PI to flip 180°
          const fwd = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
          const yaw = Math.atan2(fwd.x, fwd.z) + Math.PI;

          // Send position update to server/other players (include crouch state)
          onPositionUpdate(
            [position.x, position.y, position.z],
            [0, yaw, 0],
            { isCrouching: keys.crouch && isOnGround.current }
          );

          lastPositionUpdateTime.current = now;
        }

        // Get current velocity - only log occasionally to reduce console spam
        if (debugMode && now - lastLogTime.current >= LOG_RATE) {
          const velocity = playerRef.current.linvel();
          console.log(
            "Velocity:",
            velocity.x.toFixed(2),
            velocity.y.toFixed(2),
            velocity.z.toFixed(2)
          );
          console.log("Keys state:", keys);

          lastLogTime.current = now;
        }

        // Get movement directions based on camera orientation
        const forward = new Vector3(0, 0, -1);
        const right = new Vector3(1, 0, 0);
        forward.applyQuaternion(camera.quaternion);
        right.applyQuaternion(camera.quaternion);

        // Zero out the y component and normalize
        forward.y = 0;
        right.y = 0;
        if (forward.length() > 0) forward.normalize();
        if (right.length() > 0) right.normalize();

        // Calculate movement vector with direction-specific speeds
        const movement = new Vector3(0, 0, 0);
        const forwardSpeed = 1.0;
        const backwardSpeed = 0.7; // 70% of forward speed
        const strafeSpeed = 0.8; // 80% of forward speed

        if (moveForward)
          movement.add(forward.clone().multiplyScalar(forwardSpeed));
        if (moveBackward)
          movement.sub(forward.clone().multiplyScalar(backwardSpeed));
        if (moveLeft) movement.sub(right.clone().multiplyScalar(strafeSpeed));
        if (moveRight) movement.add(right.clone().multiplyScalar(strafeSpeed));

        // Apply movement if there's any input
        if (movement.length() > 0) {
          // Normalize only if length > 1 to preserve slower speeds for single directions
          if (movement.length() > 1) {
            movement.normalize();
          }

          // Get current velocity
          const currentVel = playerRef.current.linvel();

          // Set a target speed based on stance (standing or crouching)
          let targetSpeed;
          if (keys.crouch) {
            // Crouching speed (much slower)
            targetSpeed = keys.sprint ? 6 : 4;
          } else {
            // Normal speed
            targetSpeed = keys.sprint ? 20 : 12;
          }

          movement.multiplyScalar(targetSpeed);

          // Set the velocity directly, but keep the y component (for gravity/jumping)
          playerRef.current.setLinvel(
            {
              x: movement.x,
              y: currentVel.y, // Keep vertical velocity for jumping/falling
              z: movement.z,
            },
            true
          );

          console.log(
            "Setting velocity:",
            movement.x.toFixed(2),
            movement.z.toFixed(2)
          );
        } else if (isOnGround.current) {
          // If no movement keys are pressed but player is moving horizontally, apply stopping force
          const currentVel = playerRef.current.linvel();
          if (Math.abs(currentVel.x) > 0.1 || Math.abs(currentVel.z) > 0.1) {
            // Apply a strong stopping force
            playerRef.current.setLinvel(
              {
                x: currentVel.x * 0.8, // Reduce horizontal velocity by 20% each frame
                y: currentVel.y,
                z: currentVel.z * 0.8,
              },
              true
            );

            // If velocity is very small, just stop completely
            if (Math.abs(currentVel.x) < 0.5 && Math.abs(currentVel.z) < 0.5) {
              playerRef.current.setLinvel(
                {
                  x: 0,
                  y: currentVel.y,
                  z: 0,
                },
                true
              );
            }
          }
        }

        // Handle jumping with stricter controls
        if (keys.jump) {
          const now = Date.now();
          const timeSinceLastJump = now - lastJumpTime.current;

          // Only allow jumping if:
          // 1. We're on the ground
          // 2. We're not already jumping
          // 3. Enough time has passed since last jump
          if (
            isOnGround.current &&
            !isJumping.current &&
            timeSinceLastJump > STRICT_JUMP_COOLDOWN
          ) {
            console.log("Jumping!");

            // Apply stronger upward impulse
            playerRef.current.applyImpulse({ x: 0, y: JUMP_FORCE, z: 0 }, true);

            // Track jump state
            isJumping.current = true;
            lastJumpTime.current = now;
            jumpStartY.current = position.y;

            // Force player to be considered not on ground immediately
            isOnGround.current = false;
          }
        }

        // Reset jump state when landing
        if (isOnGround.current && isJumping.current) {
          // Calculate max height reached during jump
          const jumpHeight = maxJumpHeight.current - jumpStartY.current;
          console.log(
            `Landed after jumping ${jumpHeight.toFixed(2)} units high`
          );

          // Reset jump tracking
          isJumping.current = false;
          maxJumpHeight.current = 0;
        }

        // Track maximum height during jump
        if (!isOnGround.current && isJumping.current) {
          maxJumpHeight.current = Math.max(maxJumpHeight.current, position.y);
        }

        // Apply extra downward force when falling to make falls faster
        if (!isOnGround.current && velocity.y < 0) {
          // Apply extra downward force when falling
          // playerRef.current.applyForce({ x: 0, y: -200, z: 0 }, true);
        }

        // Add a hard limit to prevent extreme heights
        // If player somehow gets too high, apply downward force
        const MAX_HEIGHT = 50; // Maximum allowed height
        if (position.y > MAX_HEIGHT) {
          // playerRef.current.applyForce({ x: 0, y: -500, z: 0 }, true);
          console.log("Height limit reached, applying downward force");
        }

        // Handle crouching - SIMPLIFIED to just handle camera position
        const standingHeight = 1.7;
        const crouchingHeight = 0.85;

        if (keys.crouch && isOnGround.current) {
          // When crouching, lower the camera
          camera.position.set(
            position.x,
            position.y + crouchingHeight, // Lower camera position
            position.z
          );

          // Note: We no longer set velocity here, it's handled in the movement section above
        } else {
          // Normal standing height
          camera.position.set(
            position.x,
            position.y + standingHeight,
            position.z
          );
        }

        // Camera bob removed — it caused visible ghosting/blur on the
        // first-person gun model because the gun reads camera position one
        // useFrame tick later, producing a double-image artifact.

        // Handle replenishing - moved from separate useFrame to be more efficient
        if (isReplenishing) {
          const now = Date.now();
          const elapsed = now - replenishStartTime;
          const progress = Math.min(elapsed / REPLENISH_TIME, 1);
          setReplenishProgress(progress);

          // Update UI about replenish progress
          if (onPlayerState) {
            onPlayerState({
              isReplenishing: true,
              replenishProgress: progress,
            });
          }

          // Check if replenish is complete
          if (progress >= 1) {
            finishReplenish();
          }

          // Don't allow shooting while replenishing
          return;
        }

        // Update canister crate proximity check less frequently to improve performance
        if (frameCount.current % 5 === 0) {
          // Get current position safely - ensure we have a position even if translation() fails
          let position;
          try {
            if (
              isLocalPlayer &&
              playerRef.current &&
              typeof playerRef.current.translation === "function"
            ) {
              // Local player with RigidBody has translation() method
              position = playerRef.current.translation();
            } else {
              // Remote player or non-initialized player - use the playerPosition state
              position = {
                x: playerPosition.x,
                y: playerPosition.y,
                z: playerPosition.z,
              };
            }
          } catch (error) {
            console.error(
              "Error getting player position for crate detection:",
              error
            );
            // Fall back to playerPosition state
            position = {
              x: playerPosition.x,
              y: playerPosition.y,
              z: playerPosition.z,
            };
          }

          // Check if near red or blue canister crate
          // Update coordinates to match the positions of crates at rear walls
          const redCratePos = [0, 0, -130]; // Red castle crate position (back wall)
          const blueCratePos = [0, 0, 130]; // Blue castle crate position (back wall)

          const distToRedCrate = Math.sqrt(
            Math.pow(position.x - redCratePos[0], 2) +
              Math.pow(position.z - redCratePos[2], 2)
          );

          const distToBlueCrate = Math.sqrt(
            Math.pow(position.x - blueCratePos[0], 2) +
              Math.pow(position.z - blueCratePos[2], 2)
          );

          // Increase detection range to 5 meters for easier interaction
          const isNearCrate = distToRedCrate < 5 || distToBlueCrate < 5;

          // Only update state if it changed to reduce re-renders
          if (isNearCrate !== isNearCanisterCrate) {
            setIsNearCanisterCrate(isNearCrate);

            // Update UI about canister crate proximity
            if (onPlayerState) {
              onPlayerState({
                isNearCanisterCrate: isNearCrate,
              });
            }
          }
        }

        // Check if the player is near a canister crate and can replenish
        if (
          reloadInput &&
          !effectiveIsReloading &&
          !isReplenishing &&
          isNearCanisterCrate &&
          gameStats
        ) {
          startReplenish();
        } else if (!reloadInput && isReplenishing) {
          // Cancel replenish if key is released
          cancelReplenish();
        }

        // Check for flag capture zones every few frames
        if (frameCount.current % 5 === 0) {
          // Get current position safely
          let position;
          try {
            if (
              isLocalPlayer &&
              playerRef.current &&
              typeof playerRef.current.translation === "function"
            ) {
              // Local player with RigidBody has translation() method
              position = playerRef.current.translation();
            } else {
              // Remote player or non-initialized player - use the playerPosition state
              position = {
                x: playerPosition.x,
                y: playerPosition.y,
                z: playerPosition.z,
              };
            }
          } catch (error) {
            console.error(
              "Error getting player position for flag detection:",
              error
            );
            // Fall back to playerPosition state
            position = {
              x: playerPosition.x,
              y: playerPosition.y,
              z: playerPosition.z,
            };
          }

          // Flag positions for both teams
          const redFlagPos = [0, 0, -120]; // Red team flag at north castle
          const blueFlagPos = [0, 0, 120]; // Blue team flag at south castle

          // Calculate distance to flags
          const distToRedFlag = Math.sqrt(
            Math.pow(position.x - redFlagPos[0], 2) +
              Math.pow(position.z - redFlagPos[2], 2)
          );

          const distToBlueFlag = Math.sqrt(
            Math.pow(position.x - blueFlagPos[0], 2) +
              Math.pow(position.z - blueFlagPos[2], 2)
          );

          // Check if near any flag (using 3-meter radius)
          let newNearFlagTeam = null;
          if (distToRedFlag < 3) {
            newNearFlagTeam = "Red";
          } else if (distToBlueFlag < 3) {
            newNearFlagTeam = "Blue";
          }

          // Check if near home base for flag return
          setNearHomeBase(
            (team === "Red" && distToRedFlag < 3) ||
              (team === "Blue" && distToBlueFlag < 3)
          );

          // Only update state if it changed to reduce re-renders
          if (newNearFlagTeam !== nearFlagTeam) {
            setNearFlagTeam(newNearFlagTeam);

            // Update UI about flag proximity
            if (onPlayerState) {
              onPlayerState({
                nearFlagTeam: newNearFlagTeam,
                nearHomeBase:
                  (team === "Red" && distToRedFlag < 3) ||
                  (team === "Blue" && distToBlueFlag < 3),
              });
            }
          }
        }

        // Check if the player is respawning
        if (isRespawning) {
          // Optional: Ensure velocity is zeroed out while respawning
          if (
            playerRef.current.linvel &&
            (playerRef.current.linvel().x !== 0 ||
              playerRef.current.linvel().z !== 0)
          ) {
            playerRef.current.setLinvel(
              { x: 0, y: playerRef.current.linvel().y, z: 0 },
              true
            );
          }
          return; // Skip all movement/action updates if respawning
        }
      }

      // Everything below (reload, shoot, flag capture) is local-player-only logic.
      // Remote players don't have gameStats or input — bail out here.
      if (!isLocalPlayer) return;

      // Handle reloading
      if (effectiveIsReloading) {
        const now = Date.now();
        const elapsed = now - reloadStartTime.current;
        const progress = Math.min(elapsed / RELOAD_TIME, 1);

        console.log(`Reload progress: ${(progress * 100).toFixed(1)}%`);

        // Only update if progress changed by at least 1%
        if (Math.abs(progress - effectiveReloadProgress) >= 0.01) {
          setReloadProgressLocal(progress);

          // Update UI about reload progress
          if (onPlayerState) {
            onPlayerState({
              isReloading: true,
              reloadProgress: progress,
            });
          }
        }

        // Check if reload is complete
        if (progress >= 1) {
          console.log("Reload complete, progress reached 100%");
          finishReload();
        }

        // Don't allow shooting while reloading
        return;
      }

      // Check if chamber is empty but canisters remain
      if (gameStats.chamberAmmo === 0 && gameStats.canistersRemaining > 0) {
        if (reloadInput) {
          startReload();
        }
      }

      // Normal shooting
      if (effectiveIsShooting && gameStats.chamberAmmo > 0) {
        const now = Date.now();
        if (now - lastShotTime.current >= FIRE_RATE) {
          shoot();
          lastShotTime.current = now;
        }
      }

      // Check for reload key is being held - Add more debugging
      if (reloadInput && !effectiveIsReloading) {
        console.log(
          "Reload key detected via hook, canister status:",
          gameStats ? gameStats.canistersRemaining : "no stats"
        );

        // Remove the restriction that chamber must be empty to reload
        if (gameStats && gameStats.canistersRemaining > 0) {
          console.log("Starting reload process via hook...");
          startReload();
        } else {
          console.log(
            "Cannot reload: ",
            !gameStats ? "no game stats" : "no canisters remaining"
          );
        }
      } else if (reloadInput && effectiveIsReloading) {
        console.log(
          "Reload in progress: ",
          effectiveReloadProgress * 100,
          "% complete"
        );
      } else if (!reloadInput && effectiveIsReloading) {
        // Cancel reload if key is released - restore this functionality
        cancelReload();
      }

      // Check if player is pressing the shoot input (from keyboard controls hook)
      // Restore shooting functionality
      if (shootInput && !effectiveIsReloading && ammoAvailable()) {
        shoot();
      }

      // Check for flag capture input (Key F)
      if (captureInput) {
        console.log(`Flag capture input detected: 
          nearFlagTeam: ${nearFlagTeam}
          isCarryingFlag: ${isCarryingFlag}
          nearHomeBase: ${nearHomeBase}
          team: ${team}
        `);

        // Don't repeatedly process - only on newly pressed
        if (
          !lastCaptureState.current &&
          nearFlagTeam &&
          !isCarryingFlag &&
          nearFlagTeam !== team
        ) {
          console.log(`Attempting to capture ${nearFlagTeam} flag`);
          // Instead of trying to update the state directly, call the onFlagCapture callback
          // which will update the parent component's state
          onFlagCapture(nearFlagTeam);

          // Update UI about flag carrying status
          if (onPlayerState) {
            onPlayerState({
              isCarryingFlag: true,
              carryingFlagTeam: nearFlagTeam,
            });
          }
        } else if (
          !lastCaptureState.current &&
          isCarryingFlag &&
          nearHomeBase
        ) {
          console.log(`Returning ${carryingFlagTeam} flag to base`);
          onFlagReturn(carryingFlagTeam);

          // Update UI about flag return
          if (onPlayerState) {
            onPlayerState({
              isCarryingFlag: false,
              carryingFlagTeam: null,
            });
          }
        }
        lastCaptureState.current = true;
      } else {
        lastCaptureState.current = false;
      }

      // Throttle debug logging to avoid console spam
      if (isLocalPlayer && debugMode && frameCount.current % 60 === 0) {
        console.log(`Player state: 
          shootInput: ${shootInput}
          reloadInput: ${reloadInput}
          captureInput: ${captureInput}
          isShooting: ${effectiveIsShooting}
          isReloading: ${effectiveIsReloading}
          ammoAvailable: ${ammoAvailable()}
          nearFlagTeam: ${nearFlagTeam}
          nearHomeBase: ${nearHomeBase}
          isCarryingFlag: ${isCarryingFlag}
          carryingFlagTeam: ${carryingFlagTeam}
          isNearCanisterCrate: ${isNearCanisterCrate}
          position: ${JSON.stringify(playerPosition)}
        `);
      }
    });

    // Handle camera rotation
    const [cameraRotation, setCameraRotation] = useState([0, 0, 0]);

    useEffect(() => {
      const handleMouseMove = (e) => {
        if (document.pointerLockElement) {
          const sensitivity = 0.002;
          const rotX = cameraRotation[0] - e.movementY * sensitivity;
          const rotY = cameraRotation[1] - e.movementX * sensitivity;

          // Limit vertical rotation
          const clampedRotX = Math.max(
            -Math.PI / 2,
            Math.min(Math.PI / 2, rotX)
          );

          setCameraRotation([clampedRotX, rotY, 0]);
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      return () => document.removeEventListener("mousemove", handleMouseMove);
    }, [cameraRotation]);

    // Handle refilling
    useEffect(() => {
      if (isRefilling) {
        const interval = setInterval(() => {
          setRefillProgress((prev) => {
            const newProgress = prev + (1 / REFILL_TIME) * 0.1;
            if (newProgress >= 1) {
              clearInterval(interval);
              finishRefill();
              return 0;
            }
            return newProgress;
          });
        }, 100);

        return () => clearInterval(interval);
      }
    }, [isRefilling]);

    // Function to start reload
    const startReload = () => {
      console.log("startReload called, checking conditions:", {
        effectiveIsReloading,
        gameStats: gameStats
          ? `Stats available, canisters: ${gameStats.canistersRemaining}`
          : "No stats",
      });

      // Allow reload at any time as long as we have canisters
      if (effectiveIsReloading) {
        console.log("Cannot reload: Already reloading");
        return;
      }

      if (!gameStats) {
        console.log("Cannot reload: No game stats available");
        return;
      }

      // Check if we have any canisters left
      if (gameStats.canistersRemaining <= 0) {
        console.log("Cannot reload: No canisters remaining");
        return;
      }

      console.log("Starting reload...");
      setIsReloadingLocal(true);
      reloadStartTime.current = Date.now();
      setReloadProgressLocal(0);

      // Notify Game component that reload has started
      if (onReload) {
        try {
          console.log("Calling onReload('start')");
          onReload("start");
        } catch (error) {
          console.error("Error in onReload:", error);
        }
      }

      // Notify UI about reload status
      if (onPlayerState) {
        try {
          onPlayerState({
            isReloading: true,
            reloadProgress: 0,
          });
        } catch (error) {
          console.error("Error in onPlayerState:", error);
        }
      }
    };

    // Function to cancel reload
    const cancelReload = () => {
      if (!effectiveIsReloading) return;

      console.log("Reload canceled");
      setIsReloadingLocal(false);
      setReloadProgressLocal(0);

      // Notify UI about reload status
      if (onPlayerState) {
        onPlayerState({
          isReloading: false,
          reloadProgress: 0,
        });
      }
    };

    // Function to finish reload
    const finishReload = () => {
      console.log("finishReload called, current state:", {
        gameStats: gameStats ? "available" : "not available",
        isReloading: effectiveIsReloading,
      });

      if (!gameStats) {
        console.log("Cannot finish reload: No game stats available");
        return;
      }

      if (!effectiveIsReloading) {
        console.log("Cannot finish reload: Not currently reloading");
        return;
      }

      console.log("Reload complete, updating state");
      setIsReloadingLocal(false);
      setReloadProgressLocal(0);

      // Notify Game component about the reload completion
      if (onReload) {
        try {
          console.log("Calling onReload('complete') to update ammo");
          onReload("complete");
        } catch (error) {
          console.error("Error in onReload complete:", error);
        }
      }

      // Notify UI about reload status
      if (onPlayerState) {
        try {
          onPlayerState({
            isReloading: false,
            reloadProgress: 0,
          });
        } catch (error) {
          console.error("Error updating UI about reload completion:", error);
        }
      }
    };

    // Function to check if reload key is pressed after emptying a batch
    const startReloadIfKeyPressed = () => {
      if (reloadInput) {
        startReload();
      }
    };

    // Clean up interval on unmount
    useEffect(() => {
      return () => {
        if (reloadIntervalRef.current) {
          clearInterval(reloadIntervalRef.current);
        }
      };
    }, []);

    // Check if player is near a refill station
    const [nearRefillStation, setNearRefillStation] = useState(false);

    // Update player movement and actions (local player only)
    useFrame((state, delta) => {
      if (!isLocalPlayer || !playerRef.current) return;

      // Get current position and rotation
      const position = playerRef.current.translation();

      // Check if near refill station (red or blue castle)
      const redStationPos = [0, 0, -120];
      const blueStationPos = [0, 0, 120];
      const distToRed = Math.sqrt(
        Math.pow(position.x - redStationPos[0], 2) +
          Math.pow(position.z - redStationPos[2], 2)
      );
      const distToBlue = Math.sqrt(
        Math.pow(position.x - blueStationPos[0], 2) +
          Math.pow(position.z - blueStationPos[2], 2)
      );

      const isNearStation = distToRed < 10 || distToBlue < 10;
      setNearRefillStation(isNearStation);

      // Handle refill input
      if (nearRefillStation && refillInput && !effectiveIsReloading) {
        startRefill();
      } else if (!refillInput && isRefilling) {
        // Cancel refill if player releases key
        setIsRefilling(false);
        setRefillProgress(0);
      }

      // Handle reload input
      if (reloadInput && !effectiveIsReloading && !isRefilling) {
        startReload();
      }
    });

    // Move this function just before the shoot function (around line 1060)
    const ammoAvailable = () => {
      return gameStats && gameStats.chamberAmmo > 0;
    };

    const shoot = () => {
      const effectiveIsReloading = isReloading; // Use prop directly if passed down

      if (
        effectiveIsReloading ||
        maxJumpHeight.current > 0 || // Check if currently jumping high
        lastShotTime.current + FIRE_RATE > Date.now() ||
        !ammoAvailable()
      ) {
        console.log("Cannot shoot: conditions not met", {
          isReloading: effectiveIsReloading,
          jumpHeight: maxJumpHeight.current,
          lastShot: lastShotTime.current,
          hasAmmo: ammoAvailable(),
          timestamp: Date.now(),
        });
        return false;
      }

      if (!camera) {
        console.warn("Cannot shoot: camera not available");
        return false;
      }

      lastShotTime.current = Date.now();
      console.log("Shooting...");

      // Trigger internal shooting state for potential local feedback/sounds
      if (!isShooting) {
        // Check the prop passed from Game.js
        setIsShooting_internal(true);
        setTimeout(() => setIsShooting_internal(false), 100);
      }

      if (onShoot) {
        // --- Direction: always centre-screen (crosshair) ---
        const directionVector = new Vector3();
        camera.getWorldDirection(directionVector);
        directionVector.normalize();
        const direction = [
          directionVector.x,
          directionVector.y,
          directionVector.z,
        ];

        // --- Origin: barrel tip of the first-person gun ---
        let originVector;
        if (fpGunRef.current && fpGunRef.current.getBarrelTipWorldPosition) {
          originVector = fpGunRef.current.getBarrelTipWorldPosition();
        }
        // Fallback if gun ref not available
        if (!originVector) {
          originVector = new Vector3();
          camera.getWorldPosition(originVector);
          // Lower from eye level to gun level, push forward
          originVector.y -= 0.35;
          originVector.addScaledVector(directionVector, 0.5);
        }

        const visualOrigin = [originVector.x, originVector.y, originVector.z];

        try {
          onShoot(visualOrigin, direction);
          return true;
        } catch (error) {
          console.error("Error during shot:", error);
          return false;
        }
      }

      return false;
    };

    // Add an effect to log when player is first created
    useEffect(() => {
      console.log("Player component mounted, team:", team);
      console.log("Initial position:", position);

      // Log when rigid body is initialized
      if (playerRef.current) {
        console.log("RigidBody already initialized on mount");
      } else {
        console.log("RigidBody not yet initialized on mount");
      }

      return () => {
        console.log("Player component unmounting");
      };
    }, []);

    // Track rigid body initialization (local player only)
    useEffect(() => {
      if (isLocalPlayer && playerRef.current && typeof playerRef.current.translation === "function") {
        console.log(
          "RigidBody initialized, position:",
          playerRef.current.translation()
        );
      }
    }, [playerRef.current, isLocalPlayer]);

    useEffect(() => {
      console.log(
        `Player component MOUNT, team: ${team}, at position:`,
        position
      );
      return () => {
        console.log(`Player component UNMOUNT, team: ${team}`);
      };
    }, []);

    // Return a stabilized version of the position
    const getRigidBodyPosition = () => {
      // Use the stable cached position after initial setup
      if (rigidBodyInitialized.current) {
        return stablePosition.current;
      }
      // First time initialization - store the position
      stablePosition.current = position;
      rigidBodyInitialized.current = true;
      return position;
    };

    // Add an effect to track team changes
    useEffect(() => {
      if (team) {
        console.log(`Player team set/changed to: ${team}`);
        // When team changes, allow position updates again
        positionHasBeenSet.current = false;
      }
    }, [team]);

    // Check for keyboard events related to reloading
    useEffect(() => {
      // Only add this effect for local players
      if (!isLocalPlayer) return;

      const handleKeyDown = (e) => {
        if (e.code === "KeyR") {
          console.log("R KEY PRESSED DIRECTLY - Triggering reload");
          if (
            !effectiveIsReloading &&
            gameStats &&
            gameStats.canistersRemaining > 0
          ) {
            console.log("DIRECT RELOAD START");
            startReload();
          }
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isLocalPlayer, effectiveIsReloading, gameStats]);

    return (
      <>
        {isLocalPlayer ? (
          <>
            {/* First-person gun - follows camera each frame */}
            <FirstPersonGun
              ref={fpGunRef}
              team={team}
              isShooting={effectiveIsShooting}
              isReloading={effectiveIsReloading}
              reloadProgress={effectiveReloadProgress}
            />

            {/* Local player with physics */}
            <RigidBody
              ref={playerRef}
              position={getRigidBodyPosition()}
              enabledRotations={[false, false, false]}
              linearDamping={5.0}
              type="dynamic"
              colliders={false}
              userData={{ type: "player", isLocal: true }}
              name="player"
              friction={0.1}
              restitution={0.0}
              lockRotations={true}
              mass={1.0}
              gravityScale={4.0}
              ccd={true}
              onCollisionEnter={() => {
                if (!disableCollisionHandling.current) {
                  console.log("Player collision detected");
                  // Disable further collision handling after initial setup
                  disableCollisionHandling.current = true;
                }
              }}
            >
              {/* Position the collider so its base aligns with y=0 */}
              <CapsuleCollider args={[0.85, 0.5]} position={[0, 0.85, 0]} />

              {/* Invisible mesh for the local player */}
              <mesh visible={false}>
                <capsuleGeometry args={[0.5, 1.7, 8, 16]} />
                <meshBasicMaterial
                  attach="material"
                  color={team === "Red" ? "#ff0000" : "#0066ff"}
                  opacity={0}
                  transparent
                />
              </mesh>
            </RigidBody>
          </>
        ) : (
          // Remote player with character model and name tag
          <group
            ref={playerRef}
            position={position}
            rotation={rotation}
            userData={{ type: "player", isLocal: false }}
          >
            <CharacterModel
              team={team}
              name={name}
              isLocalPlayer={false}
              isCarryingFlag={isCarryingFlag}
              carryingFlagTeam={carryingFlagTeam}
              useLowDetail={useLowDetail}
              isShooting={isShooting}
              isReloading={isReloading}
              isCrouching={isCrouching}
            />
          </group>
        )}
      </>
    );
  }
);

// Add display name to fix the ESLint error
Player.displayName = "Player";

export default Player;
