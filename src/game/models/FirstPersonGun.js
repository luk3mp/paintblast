import React, { useRef, useMemo, useEffect } from "react";
import { createPortal, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

/**
 * CS-style first-person gun that is a direct child of the camera.
 *
 * By rendering via createPortal(jsx, camera) the gun lives in the
 * camera's local coordinate system.  It moves with the camera with
 * ZERO frame lag — no useFrame positioning needed at all.
 *
 * Depth technique:
 *   1. Sentinel mesh (renderOrder 998) clears the depth buffer
 *   2. Gun meshes (renderOrder 999) draw on top of the world
 *   3. Gun materials use normal depthTest so parts occlude each other
 */
const FirstPersonGun = React.memo(
  React.forwardRef(({ team = "Red" }, ref) => {
    const barrelTipRef = useRef();
    const depthClearRef = useRef();
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

    // Attach depth-buffer clear to sentinel mesh
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

    // ── Render gun as a direct child of the camera ──────────────
    // Position is in camera-local space:
    //   x = right/left,  y = up/down,  z = forward(-)/backward(+)
    // Being a child of the camera means the gun is locked to the
    // viewport with absolutely zero per-frame lag.
    return createPortal(
      <group position={[0.28, -0.22, -0.55]} frustumCulled={false}>
        {/* Depth-clear sentinel */}
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
          <mesh
            renderOrder={999}
            position={[0.02, -0.005, 0]}
            rotation={[0.2, 0, 0]}
          >
            <boxGeometry args={[0.1, 0.05, 0.14]} />
            <meshStandardMaterial color={colors.glove} roughness={0.9} />
          </mesh>
          <mesh
            renderOrder={999}
            position={[0.0, -0.015, -0.02]}
            rotation={[0.3, 0, 0]}
          >
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
          <meshStandardMaterial
            color={colors.gunMetal}
            roughness={0.35}
            metalness={0.6}
          />
        </mesh>

        {/* Top rail */}
        <mesh renderOrder={999} position={[0, 0.05, -0.04]}>
          <boxGeometry args={[0.05, 0.02, 0.28]} />
          <meshStandardMaterial
            color={colors.gunDark}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>

        {/* === GRIP === */}
        <mesh
          renderOrder={999}
          position={[0, -0.1, 0.06]}
          rotation={[-0.15, 0, 0]}
        >
          <boxGeometry args={[0.065, 0.14, 0.07]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.5} />
        </mesh>

        {/* Trigger guard */}
        <mesh renderOrder={999} position={[0, -0.04, 0.04]}>
          <boxGeometry args={[0.07, 0.015, 0.08]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} />
        </mesh>

        {/* === BARREL === */}
        <mesh
          renderOrder={999}
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

        {/* Barrel tip / muzzle — bullet origin */}
        <mesh
          ref={barrelTipRef}
          renderOrder={999}
          position={[0, 0.01, -0.46]}
          frustumCulled={false}
        >
          <cylinderGeometry
            args={[0.03, 0.035, 0.02, 8]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <meshStandardMaterial
            color="#555555"
            roughness={0.3}
            metalness={0.8}
          />
        </mesh>

        {/* Barrel shroud */}
        <mesh renderOrder={999} position={[0, 0, -0.2]}>
          <boxGeometry args={[0.075, 0.075, 0.16]} />
          <meshStandardMaterial color={colors.gunDark} roughness={0.4} />
        </mesh>

        {/* === HOPPER === */}
        <mesh renderOrder={999} position={[0, 0.12, 0.02]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial
            color={colors.accent}
            roughness={0.4}
            transparent
            opacity={0.85}
          />
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
        <mesh
          renderOrder={999}
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

        {/* Team accent stripe */}
        <mesh renderOrder={999} position={[0, 0.035, 0]}>
          <boxGeometry args={[0.087, 0.008, 0.2]} />
          <meshStandardMaterial
            color={colors.accent}
            emissive={colors.accent}
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>,
      camera
    );
  })
);

FirstPersonGun.displayName = "FirstPersonGun";

export default FirstPersonGun;
