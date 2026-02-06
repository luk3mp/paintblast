import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * CS-style first-person gun model.
 *
 * Attached as a native Three.js child of the camera (via camera.add) so it
 * tracks with zero lag. useFrame only handles recoil/reload animations.
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

    // Shared material props — gun always renders on top of the world
    const gunMatProps = { depthTest: false };

    // Expose barrel tip ref
    React.useImperativeHandle(ref, () => ({
      getBarrelTipWorldPosition: () => {
        if (barrelTipRef.current) {
          barrelTipRef.current.updateWorldMatrix(true, false);
          const pos = new (require("three").Vector3)();
          barrelTipRef.current.getWorldPosition(pos);
          return pos;
        }
        return null;
      },
    }));

    // Attach as native child of camera — zero-lag tracking
    useEffect(() => {
      const gunGroup = gunRootRef.current;
      if (!gunGroup || !camera) return;

      camera.add(gunGroup);

      // Camera-local position: bottom-right of view
      gunGroup.position.set(0.28, -0.20, -0.55);
      gunGroup.rotation.set(0, 0, 0);

      return () => {
        camera.remove(gunGroup);
      };
    }, [camera]);

    // Per-frame: only recoil + reload animation (NO idle bob)
    useFrame((state, delta) => {
      if (!gunRootRef.current) return;

      // --- Recoil trigger ---
      if (isShooting && !lastShot.current) {
        recoilAmount.current = 1;
        lastShot.current = true;
      } else if (!isShooting) {
        lastShot.current = false;
      }

      // Recoil decay
      let recoilZ = 0;
      let recoilRotX = 0;
      if (recoilAmount.current > 0) {
        recoilZ = 0.04 * recoilAmount.current;
        recoilRotX = -0.05 * recoilAmount.current;
        recoilAmount.current = Math.max(0, recoilAmount.current - delta * 10);
      }

      // Reload offsets
      let reloadOffsetY = 0;
      let reloadRotX = 0;
      if (isReloading) {
        const stage = Math.floor(reloadProgress * 3);
        if (stage === 0) {
          const t = reloadProgress * 3;
          reloadRotX = t * 0.4;
          reloadOffsetY = -t * 0.06;
        } else if (stage === 1) {
          reloadRotX = 0.4;
          reloadOffsetY = -0.06;
          if (hopperRef.current) {
            const t = (reloadProgress - 1 / 3) * 3;
            hopperRef.current.position.y =
              0.12 + Math.sin(t * Math.PI) * 0.15;
            hopperRef.current.position.x = Math.sin(t * Math.PI) * 0.1;
          }
        } else {
          const t = (reloadProgress - 2 / 3) * 3;
          reloadRotX = 0.4 * (1 - t);
          reloadOffsetY = -0.06 * (1 - t);
          if (hopperRef.current) {
            hopperRef.current.position.set(0, 0.12, 0);
          }
        }
      }

      // Apply — position is camera-local, so just set directly
      gunRootRef.current.position.set(
        0.28,
        -0.20 + reloadOffsetY,
        -0.55 + recoilZ
      );
      gunRootRef.current.rotation.set(recoilRotX + reloadRotX, 0, 0);
    });

    return (
      <group ref={gunRootRef} renderOrder={999} frustumCulled={false}>
        {/* === RIGHT HAND / ARM === */}
        <group position={[0.02, -0.06, 0.12]}>
          <mesh castShadow position={[0.06, 0.0, 0.08]} renderOrder={999}>
            <boxGeometry args={[0.09, 0.055, 0.18]} />
            <meshStandardMaterial color={colors.primary} roughness={0.8} {...gunMatProps} />
          </mesh>
          <mesh castShadow position={[0.02, -0.005, 0]} rotation={[0.2, 0, 0]} renderOrder={999}>
            <boxGeometry args={[0.1, 0.05, 0.14]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} {...gunMatProps} />
          </mesh>
          <mesh castShadow position={[0.0, -0.015, -0.02]} rotation={[0.3, 0, 0]} renderOrder={999}>
            <boxGeometry args={[0.08, 0.04, 0.06]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} {...gunMatProps} />
          </mesh>
        </group>

        {/* === LEFT HAND === */}
        <group position={[-0.02, -0.05, -0.18]}>
          <mesh castShadow renderOrder={999}>
            <boxGeometry args={[0.1, 0.05, 0.12]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} {...gunMatProps} />
          </mesh>
          <mesh castShadow position={[-0.08, 0, 0.04]} renderOrder={999}>
            <boxGeometry args={[0.08, 0.045, 0.12]} />
            <meshStandardMaterial color={colors.primary} roughness={0.8} {...gunMatProps} />
          </mesh>
        </group>

        {/* === GUN RECEIVER === */}
        <mesh castShadow receiveShadow renderOrder={999}>
          <boxGeometry args={[0.085, 0.09, 0.38]} />
          <meshStandardMaterial color={colors.gunMetal} roughness={0.35} metalness={0.6} {...gunMatProps} />
        </mesh>

        {/* Top rail */}
        <mesh castShadow position={[0, 0.05, -0.04]} renderOrder={999}>
          <boxGeometry args={[0.05, 0.02, 0.28]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.3} metalness={0.7} {...gunMatProps} />
        </mesh>

        {/* === GRIP === */}
        <mesh castShadow receiveShadow position={[0, -0.1, 0.06]} rotation={[-0.15, 0, 0]} renderOrder={999}>
          <boxGeometry args={[0.065, 0.14, 0.07]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.5} {...gunMatProps} />
        </mesh>

        {/* Trigger guard */}
        <mesh castShadow position={[0, -0.04, 0.04]} renderOrder={999}>
          <boxGeometry args={[0.07, 0.015, 0.08]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} {...gunMatProps} />
        </mesh>

        {/* === BARREL === */}
        <mesh castShadow receiveShadow position={[0, 0.01, -0.32]} rotation={[Math.PI / 2, 0, 0]} renderOrder={999}>
          <cylinderGeometry args={[0.025, 0.03, 0.28, 8]} />
          <meshStandardMaterial color={colors.gunBarrel} roughness={0.25} metalness={0.7} {...gunMatProps} />
        </mesh>

        {/* Barrel tip / muzzle */}
        <mesh ref={barrelTipRef} position={[0, 0.01, -0.46]} frustumCulled={false} renderOrder={999}>
          <cylinderGeometry args={[0.03, 0.035, 0.02, 8]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.8} {...gunMatProps} />
        </mesh>

        {/* Barrel shroud */}
        <mesh castShadow position={[0, 0, -0.2]} renderOrder={999}>
          <boxGeometry args={[0.075, 0.075, 0.16]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} {...gunMatProps} />
        </mesh>

        {/* === HOPPER === */}
        <mesh ref={hopperRef} castShadow receiveShadow position={[0, 0.12, 0.02]} renderOrder={999}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial color={colors.accent} roughness={0.4} transparent opacity={0.85} {...gunMatProps} />
        </mesh>
        <mesh castShadow position={[0, 0.065, 0.02]} renderOrder={999}>
          <cylinderGeometry args={[0.03, 0.035, 0.04, 8]} />
          <meshStandardMaterial color={colors.gunMetal} roughness={0.4} {...gunMatProps} />
        </mesh>

        {/* === STOCK === */}
        <mesh castShadow receiveShadow position={[0, -0.01, 0.24]} renderOrder={999}>
          <boxGeometry args={[0.07, 0.08, 0.12]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.5} {...gunMatProps} />
        </mesh>
        <mesh castShadow position={[0, -0.01, 0.305]} renderOrder={999}>
          <boxGeometry args={[0.075, 0.09, 0.02]} />
          <meshStandardMaterial color="#333" roughness={0.7} {...gunMatProps} />
        </mesh>

        {/* === CO2 TANK === */}
        <mesh castShadow receiveShadow position={[0, -0.07, 0.18]} rotation={[0.2, 0, 0]} renderOrder={999}>
          <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
          <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.25} {...gunMatProps} />
        </mesh>

        {/* Team colour accent stripe */}
        <mesh position={[0, 0.035, 0]} renderOrder={999}>
          <boxGeometry args={[0.087, 0.008, 0.2]} />
          <meshStandardMaterial color={colors.accent} emissive={colors.accent} emissiveIntensity={0.15} {...gunMatProps} />
        </mesh>
      </group>
    );
  }
);

FirstPersonGun.displayName = "FirstPersonGun";

export default FirstPersonGun;
