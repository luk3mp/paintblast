import React, { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Quaternion } from "three";

/**
 * CS-style first-person gun model that follows the camera each frame.
 * Positioned in the bottom-right of the viewport like Counter-Strike.
 *
 * The gun group is placed in the scene and manually synced to the camera's
 * world position + rotation every frame via useFrame. A ref to the barrel
 * tip mesh is exposed via `getBarrelTipWorldPosition()` so the parent can
 * read its world position for bullet origin.
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
    const gunRootRef = useRef(); // Root group that tracks camera
    const hopperRef = useRef();
    const barrelTipRef = useRef();

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
        hopperTint: isRed ? "#ff444490" : "#4488ff90",
      };
    }, [team]);

    // depthTest:false ensures the gun always renders on top of world geometry
    // (prevents the gun clipping through walls / looking transparent)
    const gm = { depthTest: false };

    // Expose barrel tip ref so parent can get world position
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
    // Priority 1 ensures this runs AFTER the Player component's useFrame
    // (priority 0) which sets the camera position. Reading camera state that
    // was JUST set this frame gives zero-lag tracking with no blur/ghosting.
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
          // Stage 0: gun dips down slightly
          reloadOffsetY = -(reloadProgress * 3) * 0.04;
        } else if (stage === 1) {
          // Stage 1: gun stays dipped, hopper lifts gently
          reloadOffsetY = -0.04;
          if (hopperRef.current) {
            const t = (reloadProgress - 1 / 3) * 3;
            // Subtle lift: 0.06 up, 0.03 sideways (was 0.15/0.1 — way too much)
            hopperRef.current.position.y = 0.12 + Math.sin(t * Math.PI) * 0.06;
            hopperRef.current.position.x = Math.sin(t * Math.PI) * 0.03;
            hopperRef.current.position.z = 0.02;
          }
        } else {
          // Stage 2: gun returns to normal, hopper snaps back
          const t = (reloadProgress - 2 / 3) * 3;
          reloadOffsetY = -0.04 * (1 - t);
          if (hopperRef.current) {
            hopperRef.current.position.set(0, 0.12, 0.02);
          }
        }
      } else {
        // Not reloading — ensure hopper is always at rest position
        // (prevents it staying displaced if reload was cancelled mid-animation)
        if (hopperRef.current) {
          hopperRef.current.position.set(0, 0.12, 0.02);
        }
      }

      // Compute final world position for the gun root:
      //   camera pos + right*0.28 + up*(-0.22 + reload) + forward*(0.55 - recoil)
      const offRight = 0.28;
      const offUp = -0.22 + reloadOffsetY;
      const offFwd = 0.55 - recoilZ;

      gunRootRef.current.position
        .copy(_camPos)
        .addScaledVector(_right, offRight)
        .addScaledVector(_up, offUp)
        .addScaledVector(_forward, offFwd);

      // Match camera rotation
      gunRootRef.current.quaternion.copy(_camQuat);
    }, 1); // <-- priority 1: runs AFTER Player's camera update (priority 0)

    return (
      <group ref={gunRootRef} renderOrder={999} frustumCulled={false}>
        {/* === RIGHT HAND / ARM === */}
        <group position={[0.02, -0.06, 0.12]}>
          {/* Forearm sleeve */}
          <mesh renderOrder={999} position={[0.06, 0.0, 0.08]}>
            <boxGeometry args={[0.09, 0.055, 0.18]} />
            <meshStandardMaterial color={colors.primary} roughness={0.8} {...gm} />
          </mesh>
          {/* Glove */}
          <mesh renderOrder={999} position={[0.02, -0.005, 0]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.1, 0.05, 0.14]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} {...gm} />
          </mesh>
          {/* Finger wrap around grip */}
          <mesh renderOrder={999} position={[0.0, -0.015, -0.02]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.06]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} {...gm} />
          </mesh>
        </group>

        {/* === LEFT HAND (supporting front of gun) === */}
        <group position={[-0.02, -0.05, -0.18]}>
          <mesh renderOrder={999}>
            <boxGeometry args={[0.1, 0.05, 0.12]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} {...gm} />
          </mesh>
          {/* Forearm */}
          <mesh renderOrder={999} position={[-0.08, 0, 0.04]}>
            <boxGeometry args={[0.08, 0.045, 0.12]} />
            <meshStandardMaterial color={colors.primary} roughness={0.8} {...gm} />
          </mesh>
        </group>

        {/* === GUN RECEIVER (main body) === */}
        <mesh renderOrder={999}>
          <boxGeometry args={[0.085, 0.09, 0.38]} />
          <meshStandardMaterial color={colors.gunMetal} roughness={0.35} metalness={0.6} {...gm} />
        </mesh>

        {/* Top rail */}
        <mesh renderOrder={999} position={[0, 0.05, -0.04]}>
          <boxGeometry args={[0.05, 0.02, 0.28]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.3} metalness={0.7} {...gm} />
        </mesh>

        {/* === GRIP === */}
        <mesh renderOrder={999} position={[0, -0.1, 0.06]} rotation={[-0.15, 0, 0]}>
          <boxGeometry args={[0.065, 0.14, 0.07]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.5} {...gm} />
        </mesh>

        {/* Trigger guard */}
        <mesh renderOrder={999} position={[0, -0.04, 0.04]}>
          <boxGeometry args={[0.07, 0.015, 0.08]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} {...gm} />
        </mesh>

        {/* === BARREL === */}
        <mesh renderOrder={999} position={[0, 0.01, -0.32]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.28, 8]} />
          <meshStandardMaterial color={colors.gunBarrel} roughness={0.25} metalness={0.7} {...gm} />
        </mesh>

        {/* Barrel tip / muzzle — bullet origin point */}
        <mesh ref={barrelTipRef} renderOrder={999} position={[0, 0.01, -0.46]} frustumCulled={false}>
          <cylinderGeometry args={[0.03, 0.035, 0.02, 8]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.8} {...gm} />
        </mesh>

        {/* Barrel shroud / handguard */}
        <mesh renderOrder={999} position={[0, 0, -0.2]}>
          <boxGeometry args={[0.075, 0.075, 0.16]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} {...gm} />
        </mesh>

        {/* === HOPPER (paintball container on top) === */}
        <mesh ref={hopperRef} renderOrder={999} position={[0, 0.12, 0.02]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial color={colors.accent} roughness={0.4} transparent opacity={0.85} {...gm} />
        </mesh>
        {/* Hopper neck */}
        <mesh renderOrder={999} position={[0, 0.065, 0.02]}>
          <cylinderGeometry args={[0.03, 0.035, 0.04, 8]} />
          <meshStandardMaterial color={colors.gunMetal} roughness={0.4} {...gm} />
        </mesh>

        {/* === STOCK (back of gun) === */}
        <mesh renderOrder={999} position={[0, -0.01, 0.24]}>
          <boxGeometry args={[0.07, 0.08, 0.12]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.5} {...gm} />
        </mesh>
        {/* Stock pad */}
        <mesh renderOrder={999} position={[0, -0.01, 0.305]}>
          <boxGeometry args={[0.075, 0.09, 0.02]} />
          <meshStandardMaterial color="#333" roughness={0.7} {...gm} />
        </mesh>

        {/* === CO2 TANK (below/behind) === */}
        <mesh renderOrder={999} position={[0, -0.07, 0.18]} rotation={[0.2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
          <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.25} {...gm} />
        </mesh>

        {/* Team colour accent stripe on receiver */}
        <mesh renderOrder={999} position={[0, 0.035, 0]}>
          <boxGeometry args={[0.087, 0.008, 0.2]} />
          <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.15} {...gm} />
        </mesh>
      </group>
    );
  }
);

FirstPersonGun.displayName = "FirstPersonGun";

export default FirstPersonGun;
