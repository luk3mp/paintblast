import React, { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * First-person gun model for the local player
 * Includes hand and gun animations for shooting and reloading
 *
 * @param {Object} props - Component props
 * @param {string} props.team - Player team ('Red' or 'Blue')
 * @param {boolean} props.isShooting - Whether the player is currently shooting
 * @param {boolean} props.isReloading - Whether the player is currently reloading
 * @param {number} props.reloadProgress - Progress of reloading (0-1)
 */
const FirstPersonGun = ({
  team = "Red",
  isShooting = false,
  isReloading = false,
  reloadProgress = 0,
}) => {
  // Reference to the gun model for animations
  const gunRef = useRef();
  const handRef = useRef();
  const hopperRef = useRef();
  const barrelRef = useRef();

  // Animation values
  const bobPhase = useRef(0);
  const recoilPhase = useRef(0);
  const reloadPhase = useRef(0);
  const lastShot = useRef(false);

  // Get threejs objects
  const { viewport } = useThree();

  // Define team colors
  const teamColors = {
    Red: {
      primary: "#ff3333", // Brighter red for primary parts
      secondary: "#cc0000", // Darker red for secondary parts
      accent: "#ff6666", // Light red for accents
      emissive: "#ff0000", // Emissive color for glowing parts
    },
    Blue: {
      primary: "#3333ff", // Brighter blue for primary parts
      secondary: "#0000cc", // Darker blue for secondary parts
      accent: "#6666ff", // Light blue for accents
      emissive: "#0000ff", // Emissive color for glowing parts
    },
  };

  // Get current team colors
  const colors = teamColors[team] || teamColors.Red;

  // Animation for gun and hands
  useFrame((state, delta) => {
    if (!gunRef.current || !handRef.current) return;

    // Track the shooting state to trigger recoil only once per shot
    if (isShooting && !lastShot.current) {
      recoilPhase.current = 1;
      lastShot.current = true;
    } else if (!isShooting && lastShot.current) {
      lastShot.current = false;
    }

    // Idle animation - gentle bobbing
    bobPhase.current += delta;

    // Base position - centered in view and closer to the camera
    let posY = 0.0; // Centered vertically in the screen
    let posX = 0.0; // Centered horizontally
    let posZ = -0.5; // Closer to the camera for better visibility

    // Get camera rotation to apply to the gun
    const { camera } = state;
    const gunRotation = camera.rotation.clone();

    // Apply slight adjustments for a natural-looking position
    let rotX = gunRotation.x;
    let rotY = gunRotation.y;
    let rotZ = gunRotation.z;

    // Add idle bobbing
    posY += Math.sin(bobPhase.current * 2) * 0.01;
    posX += Math.sin(bobPhase.current) * 0.005;

    // Handle shooting recoil animation
    if (recoilPhase.current > 0) {
      // Apply recoil forces
      posZ += 0.05 * recoilPhase.current;
      rotX += -0.1 * recoilPhase.current;

      // Decay recoil
      recoilPhase.current = Math.max(0, recoilPhase.current - delta * 8);
    }

    // Handle reloading animation
    if (isReloading) {
      // Map reload progress (0-1) to animation phases
      const reloadStage = Math.floor(reloadProgress * 3); // 3 stages: lower gun, replace hopper, raise gun

      // Stage 0: Lower gun
      if (reloadStage === 0) {
        const phase = reloadProgress * 3; // 0-1 for this stage
        rotX += phase * 0.5; // Rotate gun downward
        posY -= phase * 0.1; // Lower gun position
      }
      // Stage 1: Replace hopper (remove and add new one)
      else if (reloadStage === 1) {
        const phase = (reloadProgress - 1 / 3) * 3; // 0-1 for this stage
        rotX += 0.5; // Keep gun rotated down
        posY -= 0.1; // Keep gun lowered

        // Animate hopper removal/replacement
        if (hopperRef.current) {
          if (phase < 0.5) {
            // Moving hopper away
            hopperRef.current.position.y = 0.15 + phase * 0.4;
            hopperRef.current.position.x = phase * 0.3;
            hopperRef.current.material.opacity = 1 - phase * 2;
          } else {
            // Moving new hopper in
            hopperRef.current.position.y = 0.15 + (1 - phase) * 0.4;
            hopperRef.current.position.x = (1 - phase) * 0.3;
            hopperRef.current.material.opacity = (phase - 0.5) * 2;
          }
        }
      }
      // Stage 2: Raise gun back to position
      else if (reloadStage === 2) {
        const phase = (reloadProgress - 2 / 3) * 3; // 0-1 for this stage
        rotX += 0.5 * (1 - phase); // Rotate gun back up
        posY -= 0.1 * (1 - phase); // Raise gun back

        // Reset hopper position at the end
        if (hopperRef.current) {
          hopperRef.current.position.y = 0.15;
          hopperRef.current.position.x = 0;
          hopperRef.current.material.opacity = 1;
        }
      }
    }

    // Apply final position and rotation
    gunRef.current.position.set(posX, posY, posZ);
    gunRef.current.rotation.set(rotX, rotY, rotZ);
  });

  return (
    <group ref={gunRef} position={[0, 0, -0.5]} rotation={[0, 0, 0]}>
      {/* Right hand and arm */}
      <group ref={handRef} position={[0, -0.07, 0.1]}>
        {/* Glove */}
        <mesh castShadow position={[0, 0, 0]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.12, 0.04, 0.2]} />
          <meshStandardMaterial color="#222222" roughness={0.7} />
        </mesh>

        {/* Fingers */}
        <mesh castShadow position={[0, 0.01, 0.1]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.1, 0.03, 0.1]} />
          <meshStandardMaterial color="#222222" roughness={0.7} />
        </mesh>

        {/* Wrist & arm */}
        <mesh castShadow position={[0, -0.02, -0.1]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.11, 0.04, 0.1]} />
          <meshStandardMaterial color={colors.primary} roughness={0.7} />
        </mesh>
      </group>

      {/* Left hand - holding front of gun */}
      <group position={[0, 0, -0.3]}>
        {/* Glove */}
        <mesh castShadow position={[0, -0.05, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.12, 0.04, 0.15]} />
          <meshStandardMaterial color="#222222" roughness={0.7} />
        </mesh>

        {/* Wrist */}
        <mesh castShadow position={[-0.1, -0.05, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.1, 0.04, 0.12]} />
          <meshStandardMaterial color={colors.primary} roughness={0.7} />
        </mesh>
      </group>

      {/* Gun body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.1, 0.1, 0.5]} />
        <meshStandardMaterial color="#333333" roughness={0.4} />
      </mesh>

      {/* Gun handle */}
      <mesh castShadow receiveShadow position={[0, -0.15, 0.1]}>
        <boxGeometry args={[0.08, 0.2, 0.1]} />
        <meshStandardMaterial color="#222222" roughness={0.4} />
      </mesh>

      {/* Gun trigger */}
      <mesh castShadow receiveShadow position={[0, -0.05, 0.1]}>
        <boxGeometry args={[0.04, 0.05, 0.04]} />
        <meshStandardMaterial color="#111111" roughness={0.4} />
      </mesh>

      {/* Gun barrel */}
      <mesh
        ref={barrelRef}
        castShadow
        receiveShadow
        position={[0, 0, -0.3]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
        <meshStandardMaterial color="#444444" roughness={0.4} />
      </mesh>

      {/* Gun hopper (paintball container) */}
      <mesh ref={hopperRef} castShadow receiveShadow position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial
          color={colors.accent}
          roughness={0.4}
          transparent={true}
          opacity={0.9}
        />
      </mesh>
    </group>
  );
};

export default FirstPersonGun;
