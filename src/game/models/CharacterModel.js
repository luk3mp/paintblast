import React from "react";
import { Text } from "@react-three/drei";

/**
 * Character model for players in third-person view
 *
 * @param {Object} props
 * @param {string} props.team - Player team ('Red' or 'Blue')
 * @param {string} props.name - Player name to display
 * @param {boolean} props.isLocalPlayer - Whether this is the local player
 * @param {boolean} props.isCarryingFlag - Whether player is carrying a flag
 * @param {string} props.carryingFlagTeam - Team of the flag being carried ('Red' or 'Blue')
 * @param {boolean} props.useLowDetail - Whether to use low detail model for performance
 */
const CharacterModel = ({
  team = "Red",
  name = "Player",
  isLocalPlayer = false,
  isCarryingFlag = false,
  carryingFlagTeam = null,
  useLowDetail = false,
}) => {
  // Define team colors
  const teamColors = {
    Red: "#ff3333",
    Blue: "#3366ff",
  };

  // Get the appropriate color based on team
  const playerColor = teamColors[team] || teamColors.Red;

  // Flag color if carrying a flag
  const flagColor = carryingFlagTeam ? teamColors[carryingFlagTeam] : null;

  return (
    <group>
      {/* Player body */}
      <mesh castShadow receiveShadow>
        <capsuleGeometry args={[0.5, 1.2, 8, 16]} />
        <meshStandardMaterial color={playerColor} />
      </mesh>

      {/* Head */}
      <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={playerColor} />
      </mesh>

      {/* Arms */}
      <mesh
        castShadow
        receiveShadow
        position={[0.6, 0.3, 0]}
        rotation={[0, 0, -0.5]}
      >
        <capsuleGeometry args={[0.15, 0.7, 8, 16]} />
        <meshStandardMaterial color={playerColor} />
      </mesh>

      <mesh
        castShadow
        receiveShadow
        position={[-0.6, 0.3, 0]}
        rotation={[0, 0, 0.5]}
      >
        <capsuleGeometry args={[0.15, 0.7, 8, 16]} />
        <meshStandardMaterial color={playerColor} />
      </mesh>

      {/* Gun */}
      <mesh
        castShadow
        receiveShadow
        position={[0.6, 0.3, -0.4]}
        rotation={[0, -0.4, 0]}
      >
        <boxGeometry args={[0.1, 0.1, 0.6]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* Flag if carrying one */}
      {isCarryingFlag && flagColor && (
        <group position={[-0.5, 0.8, -0.3]}>
          <mesh castShadow position={[0, 0.5, 0]}>
            <boxGeometry args={[0.5, 0.3, 0.05]} />
            <meshStandardMaterial color={flagColor} />
          </mesh>
          <mesh castShadow>
            <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
            <meshStandardMaterial color="#aaaaaa" />
          </mesh>
        </group>
      )}

      {/* Player name tag */}
      <Text
        position={[0, 1.8, 0]}
        fontSize={0.3}
        color={team === "Red" ? "#ff3333" : "#3366ff"}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {name}
      </Text>
    </group>
  );
};

export default CharacterModel;
