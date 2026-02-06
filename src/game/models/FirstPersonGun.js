import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Quaternion } from "three";

/**
 * CS-style first-person gun model that follows the camera each frame.
 *
 * Uses the standard FPS viewmodel rendering technique:
 *   1. All gun meshes have renderOrder: 999 (drawn after world)
 *   2. A tiny sentinel mesh at renderOrder: 998 clears the depth buffer
 *      right before the gun draws
 *   3. Gun materials use NORMAL depthTest (true) so parts properly
 *      occlude each other — no see-through / ghosting artifacts
 *
 * The result: the gun always draws on top of the world AND looks solid.
 */
const FirstPersonGun = React.forwardRef(
  (
    {
      team = "Red",
      isShooting = false,
      isReloading = false,
      reloadProgress = 0,
    },
    ref
  ) => {
    const gunRootRef = useRef();
    const hopperRef = useRef();
    const barrelTipRef = useRef();
    const depthClearRef = useRef(); // Sentinel mesh for depth buffer clear

    // Animation values
    const recoilAmount = useRef(0);
    const lastShot = useRef(false);

    const { camera } = useThree();

    // Reusable vectors to avoid GC pressure
    const _camPos = useMemo(() => new Vector3(), []);
    const _camQuat = useMemo(() => new Quaternion(), []);
    const _right = useMemo(() => new Vector3(), []);
    const _up = useMemo(() => new Vector3(), []);
    const _forward = useMemo(() => new Vector3(), []);

    // Team colours
    const colors = useMemo(() => {
      const isRed = team === "Red";
      return {
        primary: isRed ? "#cc2222" : "#2255cc",
        accent: isRed ? "#ff4444" : "#4488ff",
        gunMetal: "#2a2a2a",
        gunDark: "#1a1a1a",
        gunBarrel: "#3a3a3a",
        glove: "#111111",
      };
    }, [team]);

    // --- Depth buffer clear ---
    // Attach onBeforeRender to a tiny sentinel mesh (renderOrder 998).
    // This clears the depth buffer right before the gun (renderOrder 999)
    // starts drawing, so world geometry can't occlude the gun.
    useEffect(() => {
      if (depthClearRef.current) {
        depthClearRef.current.onBeforeRender = (renderer) => {
          renderer.clearDepth();
        };
      }
    }, []);

    // Expose barrel tip world position for bullet origin
    React.useImperativeHandle(ref, () => ({
      getBarrelTipWorldPosition: () => {
        if (barrelTipRef.current) {
          const pos = new Vector3();
          barrelTipRef.current.getWorldPosition(pos);
          return pos;
        }
        return null;
      },
    }));

    // Per-frame: sync to camera + animate
    // FirstPersonGun is a child of Player, so its useFrame naturally runs
    // AFTER Player's useFrame (mount-order). Camera position is already set.
    useFrame((state, delta) => {
      if (!gunRootRef.current) return;

      // --- Sync root group to camera world transform ---
      camera.getWorldPosition(_camPos);
      camera.getWorldQuaternion(_camQuat);

      // Camera basis vectors
      _right.set(1, 0, 0).applyQuaternion(_camQuat);
      _up.set(0, 1, 0).applyQuaternion(_camQuat);
      _forward.set(0, 0, -1).applyQuaternion(_camQuat);

      // --- Recoil trigger ---
      if (isShooting && !lastShot.current) {
        recoilAmount.current = 1;
        lastShot.current = true;
      } else if (!isShooting) {
        lastShot.current = false;
      }

      // Recoil decay
      let recoilZ = 0;
      if (recoilAmount.current > 0) {
        recoilZ = 0.03 * recoilAmount.current;
        recoilAmount.current = Math.max(0, recoilAmount.current - delta * 10);
      }

      // Reload offsets — subtle gun dip + gentle hopper lift
      let reloadOffsetY = 0;
      if (isReloading) {
        const stage = Math.floor(reloadProgress * 3);
        if (stage === 0) {
          reloadOffsetY = -(reloadProgress * 3) * 0.04;
        } else if (stage === 1) {
          reloadOffsetY = -0.04;
          if (hopperRef.current) {
            const t = (reloadProgress - 1 / 3) * 3;
            hopperRef.current.position.y = 0.12 + Math.sin(t * Math.PI) * 0.06;
            hopperRef.current.position.x = Math.sin(t * Math.PI) * 0.03;
            hopperRef.current.position.z = 0.02;
          }
        } else {
          const t = (reloadProgress - 2 / 3) * 3;
          reloadOffsetY = -0.04 * (1 - t);
          if (hopperRef.current) {
            hopperRef.current.position.set(0, 0.12, 0.02);
          }
        }
      } else {
        // Safety reset when not reloading
        if (hopperRef.current) {
          hopperRef.current.position.set(0, 0.12, 0.02);
        }
      }

      // Final world position: camera + offsets in camera-local space
      const offRight = 0.28;
      const offUp = -0.22 + reloadOffsetY;
      const offFwd = 0.55 - recoilZ;

      gunRootRef.current.position
        .copy(_camPos)
        .addScaledVector(_right, offRight)
        .addScaledVector(_up, offUp)
        .addScaledVector(_forward, offFwd);

      gunRootRef.current.quaternion.copy(_camQuat);
    });

    return (
      <group ref={gunRootRef} frustumCulled={false}>
        {/* Depth-clear sentinel: tiny invisible mesh at renderOrder 998.
            Its onBeforeRender clears the depth buffer so the gun (999)
            renders on top of the world while keeping proper self-occlusion. */}
        <mesh ref={depthClearRef} renderOrder={998}>
          <planeGeometry args={[0.001, 0.001]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>

        {/* === RIGHT HAND / ARM === */}
        <group position={[0.02, -0.06, 0.12]}>
          <mesh renderOrder={999} position={[0.06, 0.0, 0.08]}>
            <boxGeometry args={[0.09, 0.055, 0.18]} />
            <meshStandardMaterial color={colors.primary} roughness={0.8} />
          </mesh>
          <mesh renderOrder={999} position={[0.02, -0.005, 0]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.1, 0.05, 0.14]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} />
          </mesh>
          <mesh renderOrder={999} position={[0.0, -0.015, -0.02]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.06]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} />
          </mesh>
        </group>

        {/* === LEFT HAND === */}
        <group position={[-0.02, -0.05, -0.18]}>
          <mesh renderOrder={999}>
            <boxGeometry args={[0.1, 0.05, 0.12]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} />
          </mesh>
          <mesh renderOrder={999} position={[-0.08, 0, 0.04]}>
            <boxGeometry args={[0.08, 0.045, 0.12]} />
            <meshStandardMaterial color={colors.primary} roughness={0.8} />
          </mesh>
        </group>

        {/* === GUN RECEIVER === */}
        <mesh renderOrder={999}>
          <boxGeometry args={[0.085, 0.09, 0.38]} />
          <meshStandardMaterial color={colors.gunMetal} roughness={0.35} metalness={0.6} />
        </mesh>

        {/* Top rail */}
        <mesh renderOrder={999} position={[0, 0.05, -0.04]}>
          <boxGeometry args={[0.05, 0.02, 0.28]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.3} metalness={0.7} />
        </mesh>

        {/* === GRIP === */}
        <mesh renderOrder={999} position={[0, -0.1, 0.06]} rotation={[-0.15, 0, 0]}>
          <boxGeometry args={[0.065, 0.14, 0.07]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.5} />
        </mesh>

        {/* Trigger guard */}
        <mesh renderOrder={999} position={[0, -0.04, 0.04]}>
          <boxGeometry args={[0.07, 0.015, 0.08]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} />
        </mesh>

        {/* === BARREL === */}
        <mesh renderOrder={999} position={[0, 0.01, -0.32]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.28, 8]} />
          <meshStandardMaterial color={colors.gunBarrel} roughness={0.25} metalness={0.7} />
        </mesh>

        {/* Barrel tip / muzzle — bullet origin */}
        <mesh ref={barrelTipRef} renderOrder={999} position={[0, 0.01, -0.46]} frustumCulled={false}>
          <cylinderGeometry args={[0.03, 0.035, 0.02, 8]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Barrel shroud */}
        <mesh renderOrder={999} position={[0, 0, -0.2]}>
          <boxGeometry args={[0.075, 0.075, 0.16]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} />
        </mesh>

        {/* === HOPPER === */}
        <mesh ref={hopperRef} renderOrder={999} position={[0, 0.12, 0.02]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial color={colors.accent} roughness={0.4} transparent opacity={0.85} />
        </mesh>
        <mesh renderOrder={999} position={[0, 0.065, 0.02]}>
          <cylinderGeometry args={[0.03, 0.035, 0.04, 8]} />
          <meshStandardMaterial color={colors.gunMetal} roughness={0.4} />
        </mesh>

        {/* === STOCK === */}
        <mesh renderOrder={999} position={[0, -0.01, 0.24]}>
          <boxGeometry args={[0.07, 0.08, 0.12]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.5} />
        </mesh>
        <mesh renderOrder={999} position={[0, -0.01, 0.305]}>
          <boxGeometry args={[0.075, 0.09, 0.02]} />
          <meshStandardMaterial color="#333" roughness={0.7} />
        </mesh>

        {/* === CO2 TANK === */}
        <mesh renderOrder={999} position={[0, -0.07, 0.18]} rotation={[0.2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
          <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.25} />
        </mesh>

        {/* Team accent stripe */}
        <mesh renderOrder={999} position={[0, 0.035, 0]}>
          <boxGeometry args={[0.087, 0.008, 0.2]} />
          <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.15} />
        </mesh>
      </group>
    );
  }
);

FirstPersonGun.displayName = "FirstPersonGun";

export default FirstPersonGun;
