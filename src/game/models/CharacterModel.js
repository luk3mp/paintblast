import React, { useMemo } from "react";
import { Text } from "@react-three/drei";

/**
 * Stylized paintball player character model
 * Has a blocky/Roblox-inspired style with paintball gear
 */
const CharacterModel = ({
  team = "Red",
  name = "Player",
  isLocalPlayer = false,
  isCarryingFlag = false,
  carryingFlagTeam = null,
  useLowDetail = false,
  isShooting = false,
  isReloading = false,
  isCrouching = false,
}) => {
  // Memoize colors to prevent re-calculations
  const colors = useMemo(() => {
    const isRed = team === "Red";
    return {
      // Main team color
      primary: isRed ? "#cc2222" : "#2255cc",
      // Lighter accent
      accent: isRed ? "#ff4444" : "#4488ff",
      // Darker shade for pants/boots
      dark: isRed ? "#881111" : "#113388",
      // Vest/armor color
      vest: isRed ? "#dd3333" : "#3366dd",
      // Visor tint
      visor: isRed ? "#ff666680" : "#6699ff80",
      // Skin tone
      skin: "#e8c39e",
      // Equipment colors
      helmet: "#333333",
      gun: "#444444",
      gunAccent: isRed ? "#cc2222" : "#2255cc",
      boots: "#222222",
      gloves: "#1a1a1a",
    };
  }, [team]);

  const flagColor = carryingFlagTeam
    ? carryingFlagTeam === "Red"
      ? "#ff3333"
      : "#3366ff"
    : null;

  // Scale factor to make characters taller / more visible
  const modelScale = 1.4;
  // Crouch: lower the model and squash slightly
  const crouchOffsetY = isCrouching ? -0.35 : 0;
  const crouchScaleY = isCrouching ? 0.75 : 1;

  // Low-detail version for performance
  if (useLowDetail) {
    return (
      <group scale={[modelScale, modelScale * crouchScaleY, modelScale]} position={[0, crouchOffsetY, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.4, 1.2, 4, 8]} />
          <meshStandardMaterial color={colors.primary} />
        </mesh>
        <Text
          position={[0, 1.5, 0]}
          fontSize={0.25}
          color={colors.accent}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {name}
        </Text>
      </group>
    );
  }

  return (
    <group scale={[modelScale, modelScale * crouchScaleY, modelScale]} position={[0, crouchOffsetY, 0]}>
      {/* === LEGS === */}
      {/* Left leg */}
      <mesh castShadow receiveShadow position={[-0.18, -0.55, 0]}>
        <boxGeometry args={[0.22, 0.65, 0.24]} />
        <meshStandardMaterial color={colors.dark} />
      </mesh>
      {/* Right leg */}
      <mesh castShadow receiveShadow position={[0.18, -0.55, 0]}>
        <boxGeometry args={[0.22, 0.65, 0.24]} />
        <meshStandardMaterial color={colors.dark} />
      </mesh>

      {/* === BOOTS === */}
      <mesh castShadow receiveShadow position={[-0.18, -0.92, 0.04]}>
        <boxGeometry args={[0.26, 0.12, 0.34]} />
        <meshStandardMaterial color={colors.boots} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.18, -0.92, 0.04]}>
        <boxGeometry args={[0.26, 0.12, 0.34]} />
        <meshStandardMaterial color={colors.boots} />
      </mesh>

      {/* === TORSO === */}
      {/* Main body */}
      <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
        <boxGeometry args={[0.55, 0.7, 0.32]} />
        <meshStandardMaterial color={colors.primary} />
      </mesh>

      {/* Tactical vest / chest plate */}
      <mesh castShadow receiveShadow position={[0, 0.18, 0.05]}>
        <boxGeometry args={[0.5, 0.5, 0.22]} />
        <meshStandardMaterial color={colors.vest} roughness={0.6} />
      </mesh>

      {/* Belt */}
      <mesh castShadow receiveShadow position={[0, -0.17, 0]}>
        <boxGeometry args={[0.56, 0.08, 0.33]} />
        <meshStandardMaterial color={colors.boots} />
      </mesh>

      {/* === ARMS === */}
      {/* Left arm (upper) */}
      <mesh
        castShadow
        receiveShadow
        position={[-0.4, 0.22, 0]}
        rotation={[0, 0, 0.15]}
      >
        <boxGeometry args={[0.18, 0.45, 0.2]} />
        <meshStandardMaterial color={colors.primary} />
      </mesh>
      {/* Left forearm */}
      <mesh
        castShadow
        receiveShadow
        position={[-0.44, -0.1, 0]}
        rotation={[0, 0, 0.15]}
      >
        <boxGeometry args={[0.16, 0.35, 0.18]} />
        <meshStandardMaterial color={colors.accent} />
      </mesh>
      {/* Left glove */}
      <mesh castShadow receiveShadow position={[-0.46, -0.32, 0]}>
        <boxGeometry args={[0.14, 0.1, 0.16]} />
        <meshStandardMaterial color={colors.gloves} />
      </mesh>

      {/* Right arm (upper) - angled forward to hold gun */}
      <mesh
        castShadow
        receiveShadow
        position={[0.4, 0.22, -0.05]}
        rotation={[0.3, 0, -0.15]}
      >
        <boxGeometry args={[0.18, 0.45, 0.2]} />
        <meshStandardMaterial color={colors.primary} />
      </mesh>
      {/* Right forearm */}
      <mesh
        castShadow
        receiveShadow
        position={[0.42, -0.04, -0.18]}
        rotation={[-0.6, 0, -0.15]}
      >
        <boxGeometry args={[0.16, 0.35, 0.18]} />
        <meshStandardMaterial color={colors.accent} />
      </mesh>
      {/* Right glove */}
      <mesh castShadow receiveShadow position={[0.42, -0.18, -0.32]}>
        <boxGeometry args={[0.14, 0.1, 0.16]} />
        <meshStandardMaterial color={colors.gloves} />
      </mesh>

      {/* === HEAD / HELMET === */}
      {/* Neck */}
      <mesh castShadow receiveShadow position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.1, 8]} />
        <meshStandardMaterial color={colors.skin} />
      </mesh>

      {/* Head */}
      <mesh castShadow receiveShadow position={[0, 0.76, 0]}>
        <boxGeometry args={[0.36, 0.36, 0.34]} />
        <meshStandardMaterial color={colors.skin} />
      </mesh>

      {/* Paintball mask - covers face */}
      <mesh castShadow receiveShadow position={[0, 0.73, 0.12]}>
        <boxGeometry args={[0.38, 0.3, 0.12]} />
        <meshStandardMaterial color={colors.helmet} roughness={0.3} />
      </mesh>

      {/* Visor */}
      <mesh position={[0, 0.78, 0.185]}>
        <boxGeometry args={[0.32, 0.12, 0.02]} />
        <meshStandardMaterial
          color={colors.accent}
          transparent
          opacity={0.7}
          metalness={0.8}
          roughness={0.1}
        />
      </mesh>

      {/* Helmet top */}
      <mesh castShadow receiveShadow position={[0, 0.9, -0.02]}>
        <boxGeometry args={[0.38, 0.12, 0.38]} />
        <meshStandardMaterial color={colors.helmet} roughness={0.4} />
      </mesh>

      {/* === PAINTBALL MARKER (GUN) === */}
      <group position={[0.38, 0.05, -0.35]} rotation={[-0.15, 0, 0]}>
        {/* Main body of marker */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.14, 0.6]} />
          <meshStandardMaterial
            color={colors.gun}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
        {/* Barrel */}
        <mesh castShadow receiveShadow position={[0, 0.02, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.045, 0.35, 8]} />
          <meshStandardMaterial
            color={colors.gun}
            metalness={0.7}
            roughness={0.2}
          />
        </mesh>
        {/* Barrel tip / muzzle */}
        <mesh castShadow receiveShadow position={[0, 0.02, -0.63]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.035, 0.06, 8]} />
          <meshStandardMaterial
            color="#222222"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        {/* Hopper (paint ball container on top) — larger and more visible */}
        <mesh castShadow receiveShadow position={[0, 0.18, 0.05]}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshStandardMaterial
            color={colors.gunAccent}
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>
        {/* Hopper neck (connects to body) */}
        <mesh castShadow receiveShadow position={[0, 0.1, 0.05]}>
          <cylinderGeometry args={[0.04, 0.04, 0.06, 6]} />
          <meshStandardMaterial color={colors.gun} />
        </mesh>
        {/* Grip */}
        <mesh castShadow receiveShadow position={[0, -0.12, 0.1]}>
          <boxGeometry args={[0.09, 0.14, 0.07]} />
          <meshStandardMaterial color={colors.gloves} />
        </mesh>
        {/* Trigger guard */}
        <mesh castShadow receiveShadow position={[0, -0.08, 0.04]}>
          <boxGeometry args={[0.06, 0.04, 0.12]} />
          <meshStandardMaterial color={colors.gun} />
        </mesh>
        {/* CO2 tank (bigger) */}
        <mesh
          castShadow
          receiveShadow
          position={[0, -0.1, 0.24]}
          rotation={[0.3, 0, 0]}
        >
          <cylinderGeometry args={[0.05, 0.05, 0.22, 8]} />
          <meshStandardMaterial
            color="#666666"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        {/* CO2 tank cap */}
        <mesh castShadow receiveShadow position={[0, -0.2, 0.28]}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* === TEAM SHOULDER PADS === */}
      <mesh castShadow receiveShadow position={[-0.35, 0.42, 0]}>
        <boxGeometry args={[0.15, 0.08, 0.26]} />
        <meshStandardMaterial color={colors.accent} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.35, 0.42, 0]}>
        <boxGeometry args={[0.15, 0.08, 0.26]} />
        <meshStandardMaterial color={colors.accent} />
      </mesh>

      {/* === FLAG (if carrying) === */}
      {isCarryingFlag && flagColor && (
        <group position={[-0.35, 0.5, -0.2]}>
          {/* Flagpole */}
          <mesh castShadow>
            <cylinderGeometry args={[0.02, 0.02, 1.2, 6]} />
            <meshStandardMaterial color="#cccccc" metalness={0.6} />
          </mesh>
          {/* Flag cloth */}
          <mesh castShadow position={[0.2, 0.35, 0]}>
            <boxGeometry args={[0.4, 0.25, 0.02]} />
            <meshStandardMaterial color={flagColor} side={2} />
          </mesh>
          {/* Flag symbol (small square) */}
          <mesh position={[0.15, 0.35, 0.015]}>
            <boxGeometry args={[0.1, 0.1, 0.01]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      )}

      {/* === NAME TAG === */}
      <Text
        position={[0, 1.15, 0]}
        fontSize={0.22}
        color={colors.accent}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
        font={undefined}
      >
        {name}
      </Text>

      {/* Team indicator dot above name */}
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color={colors.accent}
          emissive={colors.accent}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
};

export default React.memo(CharacterModel);
