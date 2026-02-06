import React, { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

/**
 * CS-style first-person gun model that follows the camera.
 * Renders in the bottom-right of the viewport.
 *
 * The gun is added as a child of the camera so it moves/rotates with the view.
 * A ref to the barrel tip mesh is exposed via `barrelTipRef` so the parent
 * can read its world position for bullet origin.
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
    const gunGroupRef = useRef();
    const hopperRef = useRef();
    const barrelTipRef = useRef();

    // Animation values
    const bobPhase = useRef(0);
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
        skin: "#e8c39e",
        hopperTint: isRed ? "#ff444490" : "#4488ff90",
      };
    }, [team]);

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

    // Per-frame animation
    useFrame((state, delta) => {
      if (!gunGroupRef.current) return;

      // --- Recoil trigger ---
      if (isShooting && !lastShot.current) {
        recoilAmount.current = 1;
        lastShot.current = true;
      } else if (!isShooting) {
        lastShot.current = false;
      }

      // Idle bob
      bobPhase.current += delta * 1.8;
      const bobY = Math.sin(bobPhase.current * 2) * 0.003;
      const bobX = Math.sin(bobPhase.current) * 0.002;

      // Recoil decay
      let recoilZ = 0;
      let recoilRotX = 0;
      if (recoilAmount.current > 0) {
        recoilZ = 0.03 * recoilAmount.current;
        recoilRotX = -0.06 * recoilAmount.current;
        recoilAmount.current = Math.max(0, recoilAmount.current - delta * 10);
      }

      // Reload animation offsets
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
          // Hopper swap animation
          if (hopperRef.current) {
            const t = (reloadProgress - 1 / 3) * 3;
            hopperRef.current.position.y = 0.12 + Math.sin(t * Math.PI) * 0.15;
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

      // Final offsets – gun sits bottom-right of screen
      // Position: right 0.28, down 0.22, forward 0.55 from camera centre
      gunGroupRef.current.position.set(
        0.28 + bobX,
        -0.22 + bobY + reloadOffsetY,
        -0.55 + recoilZ
      );
      gunGroupRef.current.rotation.set(
        recoilRotX + reloadRotX,
        0,
        0
      );
    });

    return (
      <group ref={gunGroupRef}>
        {/* === RIGHT HAND / ARM === */}
        <group position={[0.02, -0.06, 0.12]}>
          {/* Forearm sleeve */}
          <mesh castShadow position={[0.06, 0.0, 0.08]}>
            <boxGeometry args={[0.09, 0.055, 0.18]} />
            <meshStandardMaterial color={colors.primary} roughness={0.8} />
          </mesh>
          {/* Glove */}
          <mesh castShadow position={[0.02, -0.005, 0]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.1, 0.05, 0.14]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} />
          </mesh>
          {/* Finger wrap around grip */}
          <mesh castShadow position={[0.0, -0.015, -0.02]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.06]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} />
          </mesh>
        </group>

        {/* === LEFT HAND (supporting front of gun) === */}
        <group position={[-0.02, -0.05, -0.18]}>
          <mesh castShadow>
            <boxGeometry args={[0.1, 0.05, 0.12]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} />
          </mesh>
          {/* Forearm */}
          <mesh castShadow position={[-0.08, 0, 0.04]}>
            <boxGeometry args={[0.08, 0.045, 0.12]} />
            <meshStandardMaterial color={colors.primary} roughness={0.8} />
          </mesh>
        </group>

        {/* === GUN RECEIVER (main body) === */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.085, 0.09, 0.38]} />
          <meshStandardMaterial
            color={colors.gunMetal}
            roughness={0.35}
            metalness={0.6}
          />
        </mesh>

        {/* Top rail */}
        <mesh castShadow position={[0, 0.05, -0.04]}>
          <boxGeometry args={[0.05, 0.02, 0.28]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.3} metalness={0.7} />
        </mesh>

        {/* === GRIP === */}
        <mesh castShadow receiveShadow position={[0, -0.1, 0.06]} rotation={[-0.15, 0, 0]}>
          <boxGeometry args={[0.065, 0.14, 0.07]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.5} />
        </mesh>

        {/* Trigger guard */}
        <mesh castShadow position={[0, -0.04, 0.04]}>
          <boxGeometry args={[0.07, 0.015, 0.08]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} />
        </mesh>

        {/* === BARREL === */}
        <mesh
          castShadow
          receiveShadow
          position={[0, 0.01, -0.32]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.025, 0.03, 0.28, 8]} />
          <meshStandardMaterial
            color={colors.gunBarrel}
            roughness={0.25}
            metalness={0.7}
          />
        </mesh>

        {/* Barrel tip / muzzle (this is the bullet origin marker) */}
        <mesh
          ref={barrelTipRef}
          position={[0, 0.01, -0.46]}
        >
          <cylinderGeometry args={[0.03, 0.035, 0.02, 8]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Barrel shroud / handguard */}
        <mesh castShadow position={[0, 0, -0.2]}>
          <boxGeometry args={[0.075, 0.075, 0.16]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} />
        </mesh>

        {/* === HOPPER (paintball container on top) === */}
        <mesh ref={hopperRef} castShadow receiveShadow position={[0, 0.12, 0.02]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial
            color={colors.accent}
            roughness={0.4}
            transparent
            opacity={0.85}
          />
        </mesh>
        {/* Hopper neck */}
        <mesh castShadow position={[0, 0.065, 0.02]}>
          <cylinderGeometry args={[0.03, 0.035, 0.04, 8]} />
          <meshStandardMaterial color={colors.gunMetal} roughness={0.4} />
        </mesh>

        {/* === STOCK (back of gun) === */}
        <mesh castShadow receiveShadow position={[0, -0.01, 0.24]}>
          <boxGeometry args={[0.07, 0.08, 0.12]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.5} />
        </mesh>
        {/* Stock pad */}
        <mesh castShadow position={[0, -0.01, 0.305]}>
          <boxGeometry args={[0.075, 0.09, 0.02]} />
          <meshStandardMaterial color="#333" roughness={0.7} />
        </mesh>

        {/* === CO2 TANK (below/behind) === */}
        <mesh
          castShadow
          receiveShadow
          position={[0, -0.07, 0.18]}
          rotation={[0.2, 0, 0]}
        >
          <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
          <meshStandardMaterial
            color="#555555"
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>

        {/* Team colour accent stripe on receiver */}
        <mesh position={[0, 0.035, 0]}>
          <boxGeometry args={[0.087, 0.008, 0.2]} />
          <meshStandardMaterial
            color={colors.accent}
            emissive={colors.accent}
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>
    );
  }
);

FirstPersonGun.displayName = "FirstPersonGun";

export default FirstPersonGun;
