import React, { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, Quaternion } from "three";

/**
 * CS-style first-person gun model.
 *
 * Syncs to camera every frame in useFrame at **priority 1**, which runs
 * AFTER the Player component's useFrame (priority 0) that sets the camera
 * position. This guarantees zero-lag tracking with no jitter.
 *
 * All materials use depthTest:false + renderOrder:999 so the gun always
 * renders on top and never clips through world geometry.
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

    // Animation values
    const recoilAmount = useRef(0);
    const lastShot = useRef(false);

    const { camera } = useThree();

    // Reusable objects — allocated once, reused every frame (no GC)
    const _pos = useMemo(() => new Vector3(), []);
    const _quat = useMemo(() => new Quaternion(), []);
    const _right = useMemo(() => new Vector3(), []);
    const _up = useMemo(() => new Vector3(), []);
    const _fwd = useMemo(() => new Vector3(), []);
    const _localOffset = useMemo(() => new Vector3(), []);

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

    // depthTest:false so gun renders on top of everything
    const gm = { depthTest: false };

    // Expose barrel tip world position
    React.useImperativeHandle(ref, () => ({
      getBarrelTipWorldPosition: () => {
        if (barrelTipRef.current) {
          barrelTipRef.current.updateWorldMatrix(true, false);
          const p = new Vector3();
          barrelTipRef.current.getWorldPosition(p);
          return p;
        }
        return null;
      },
    }));

    // --- Priority 1: runs AFTER Player's useFrame (priority 0) ---
    // This is the key to zero-lag: we read camera state that was JUST set
    // in the same frame by the Player component.
    useFrame((state, delta) => {
      if (!gunRootRef.current) return;

      // --- Camera world transform ---
      camera.getWorldPosition(_pos);
      camera.getWorldQuaternion(_quat);

      // Camera basis vectors
      _right.set(1, 0, 0).applyQuaternion(_quat);
      _up.set(0, 1, 0).applyQuaternion(_quat);
      _fwd.set(0, 0, -1).applyQuaternion(_quat);

      // --- Recoil ---
      if (isShooting && !lastShot.current) {
        recoilAmount.current = 1;
        lastShot.current = true;
      } else if (!isShooting) {
        lastShot.current = false;
      }

      let recoilZ = 0;
      if (recoilAmount.current > 0) {
        recoilZ = 0.04 * recoilAmount.current;
        recoilAmount.current = Math.max(0, recoilAmount.current - delta * 10);
      }

      // --- Reload ---
      let reloadOffsetY = 0;
      if (isReloading) {
        const stage = Math.floor(reloadProgress * 3);
        if (stage === 0) {
          reloadOffsetY = -(reloadProgress * 3) * 0.06;
        } else if (stage === 1) {
          reloadOffsetY = -0.06;
          if (hopperRef.current) {
            const t = (reloadProgress - 1 / 3) * 3;
            hopperRef.current.position.y =
              0.12 + Math.sin(t * Math.PI) * 0.15;
            hopperRef.current.position.x = Math.sin(t * Math.PI) * 0.1;
          }
        } else {
          const t = (reloadProgress - 2 / 3) * 3;
          reloadOffsetY = -0.06 * (1 - t);
          if (hopperRef.current) {
            hopperRef.current.position.set(0, 0.12, 0);
          }
        }
      }

      // --- Position: camera + offsets in camera-local space ---
      const offRight = 0.28;
      const offUp = -0.20 + reloadOffsetY;
      const offFwd = 0.55 - recoilZ;

      gunRootRef.current.position
        .copy(_pos)
        .addScaledVector(_right, offRight)
        .addScaledVector(_up, offUp)
        .addScaledVector(_fwd, offFwd);

      gunRootRef.current.quaternion.copy(_quat);
    }, 1); // <-- priority 1: runs AFTER default priority 0

    return (
      <group ref={gunRootRef} renderOrder={999} frustumCulled={false}>
        {/* === RIGHT HAND / ARM === */}
        <group position={[0.02, -0.06, 0.12]}>
          <mesh renderOrder={999} position={[0.06, 0.0, 0.08]}>
            <boxGeometry args={[0.09, 0.055, 0.18]} />
            <meshStandardMaterial color={colors.primary} roughness={0.8} {...gm} />
          </mesh>
          <mesh renderOrder={999} position={[0.02, -0.005, 0]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.1, 0.05, 0.14]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} {...gm} />
          </mesh>
          <mesh renderOrder={999} position={[0.0, -0.015, -0.02]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.06]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} {...gm} />
          </mesh>
        </group>

        {/* === LEFT HAND === */}
        <group position={[-0.02, -0.05, -0.18]}>
          <mesh renderOrder={999}>
            <boxGeometry args={[0.1, 0.05, 0.12]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} {...gm} />
          </mesh>
          <mesh renderOrder={999} position={[-0.08, 0, 0.04]}>
            <boxGeometry args={[0.08, 0.045, 0.12]} />
            <meshStandardMaterial color={colors.primary} roughness={0.8} {...gm} />
          </mesh>
        </group>

        {/* === GUN RECEIVER === */}
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

        {/* Barrel tip / muzzle — bullet origin */}
        <mesh ref={barrelTipRef} renderOrder={999} position={[0, 0.01, -0.46]} frustumCulled={false}>
          <cylinderGeometry args={[0.03, 0.035, 0.02, 8]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.8} {...gm} />
        </mesh>

        {/* Barrel shroud */}
        <mesh renderOrder={999} position={[0, 0, -0.2]}>
          <boxGeometry args={[0.075, 0.075, 0.16]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} {...gm} />
        </mesh>

        {/* === HOPPER === */}
        <mesh ref={hopperRef} renderOrder={999} position={[0, 0.12, 0.02]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial color={colors.accent} roughness={0.4} transparent opacity={0.85} {...gm} />
        </mesh>
        <mesh renderOrder={999} position={[0, 0.065, 0.02]}>
          <cylinderGeometry args={[0.03, 0.035, 0.04, 8]} />
          <meshStandardMaterial color={colors.gunMetal} roughness={0.4} {...gm} />
        </mesh>

        {/* === STOCK === */}
        <mesh renderOrder={999} position={[0, -0.01, 0.24]}>
          <boxGeometry args={[0.07, 0.08, 0.12]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.5} {...gm} />
        </mesh>
        <mesh renderOrder={999} position={[0, -0.01, 0.305]}>
          <boxGeometry args={[0.075, 0.09, 0.02]} />
          <meshStandardMaterial color="#333" roughness={0.7} {...gm} />
        </mesh>

        {/* === CO2 TANK === */}
        <mesh renderOrder={999} position={[0, -0.07, 0.18]} rotation={[0.2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
          <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.25} {...gm} />
        </mesh>

        {/* Team colour accent stripe */}
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
