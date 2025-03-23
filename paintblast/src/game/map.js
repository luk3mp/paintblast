import { useEffect, useState, useRef, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  TextureLoader,
  RepeatWrapping,
  Color,
  MeshStandardMaterial,
  MeshBasicMaterial,
} from "three";
import {
  RigidBody,
  CuboidCollider,
  CylinderCollider,
  InstancedRigidBodies,
} from "@react-three/rapier";

// Cache for materials to avoid creating new instances
const materialCache = {};

export default function Map({
  redFlagCaptured = false,
  blueFlagCaptured = false,
}) {
  const { scene } = useThree();
  const [textures, setTextures] = useState({
    grass: null,
    dirt: null,
    brick: null,
    wood: null,
    metal: null,
    stone: null,
    sand: null,
  });

  // Refs for textures to avoid re-renders
  const texturesLoaded = useRef(false);

  // Load only the textures we have - optimize with useMemo and better error handling
  useEffect(() => {
    if (texturesLoaded.current) return;

    const textureLoader = new TextureLoader();
    const loadTexture = (url, repeat = 1) => {
      return new Promise((resolve) => {
        textureLoader.load(
          url,
          (texture) => {
            texture.wrapS = texture.wrapT = RepeatWrapping;
            texture.repeat.set(repeat, repeat);
            resolve(texture);
          },
          undefined,
          (error) => {
            console.warn(`Failed to load texture: ${url}`, error);
            resolve(null);
          }
        );
      });
    };

    // Lower texture quality for better performance
    const textureQualitySuffix = "jpg"; // Use jpg instead of png where possible

    // Load textures in parallel with better error handling
    Promise.all([
      loadTexture(`/textures/wood.${textureQualitySuffix}`, 2),
      loadTexture(`/textures/grass.${textureQualitySuffix}`, 16), // Reduced repeat from 24 to 16
      loadTexture(`/textures/brick.${textureQualitySuffix}`, 5),
      loadTexture(`/textures/stone.${textureQualitySuffix}`, 6),
      loadTexture(`/textures/sand.${textureQualitySuffix}`, 16), // Reduced repeat from 24 to 16
      loadTexture(`/textures/dirt.${textureQualitySuffix}`, 16), // Reduced repeat from 24 to 16
      loadTexture(`/textures/metal.${textureQualitySuffix}`, 2),
    ])
      .then(([wood, grass, brick, stone, sand, dirt, metal]) => {
        setTextures({
          wood,
          grass,
          brick,
          stone,
          sand,
          dirt,
          metal,
        });
        texturesLoaded.current = true;
      })
      .catch((error) => {
        console.error("Error loading textures:", error);
        // Set basic textures to avoid errors
        setTextures({
          wood: null,
          grass: null,
          brick: null,
          stone: null,
          sand: null,
          dirt: null,
          metal: null,
        });
        texturesLoaded.current = true;
      });
  }, []);

  // Create cached material for better performance
  const getMaterial = (texture, color) => {
    const key = `${texture}-${color}`;

    if (!materialCache[key]) {
      if (textures[texture]) {
        materialCache[key] = new MeshStandardMaterial({
          map: textures[texture],
          color: color,
          roughness: 0.7,
          metalness: texture === "metal" ? 0.6 : 0.1,
        });
      } else {
        materialCache[key] = new MeshStandardMaterial({
          color: color,
          roughness: 0.7,
        });
      }
    }

    return materialCache[key];
  };

  // Reusable TexturedBox component with collider matching mesh
  const TexturedBox = ({
    position,
    size,
    texture,
    color = "white",
    rotation = [0, 0, 0],
  }) => {
    const material = useMemo(() => {
      return getMaterial(texture, color);
    }, [texture, color]);

    return (
      <RigidBody
        type="fixed"
        position={position}
        rotation={rotation}
        colliders={false}
      >
        <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={size} />
          <primitive object={material} attach="material" />
        </mesh>
      </RigidBody>
    );
  };

  // Reusable TexturedCylinder component with collider matching mesh
  const TexturedCylinder = ({ position, args, texture, color = "white" }) => {
    const material = useMemo(() => {
      return getMaterial(texture, color);
    }, [texture, color]);

    return (
      <RigidBody type="fixed" position={position} colliders={false}>
        <CylinderCollider args={[args[2] / 2, args[0]]} />
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={args} />
          <primitive object={material} attach="material" />
        </mesh>
      </RigidBody>
    );
  };

  // Wait for at least the grass texture to load
  if (!textures.grass) return null;

  // Optimize PaintballCanisterCrate component - use fewer objects
  function PaintballCanisterCrate({
    position,
    rotation = [0, 0, 0],
    color = "red",
  }) {
    // Define fixed positions for the canisters - these won't change between renders
    // Use fewer canisters for better performance
    const canisterPositions = useMemo(
      () => [
        // Row 1
        [-3.0, 0.5, -1.0, 0.2, 0.1, 0.3],
        [-1.0, 0.5, -1.0, 0.3, 0.2, 0.1],
        [1.0, 0.5, -1.1, 0.2, 0.3, 0.1],
        [3.0, 0.5, -0.9, 0.1, 0.2, 0.1],

        // Row 2
        [-3.2, 0.5, 0.0, 0.3, 0.1, 0.2],
        [-1.1, 0.5, -0.1, 0.1, 0.2, 0.3],
        [1.2, 0.5, 0.0, 0.2, 0.3, 0.1],
        [3.1, 0.5, -0.1, 0.3, 0.1, 0.2],

        // Row 3
        [-3.1, 0.5, 0.9, 0.1, 0.3, 0.2],
        [-1.2, 0.5, 0.8, 0.2, 0.2, 0.1],
        [1.1, 0.5, 0.9, 0.3, 0.1, 0.3],
        [3.2, 0.5, 0.8, 0.1, 0.3, 0.2],
      ],
      []
    );

    // Use a single cached material for all canisters
    const canisterMaterial = useMemo(() => {
      return new MeshStandardMaterial({
        color: "#ffcc00",
        metalness: 0.3,
        roughness: 0.4,
      });
    }, []);

    return (
      <group position={position} rotation={rotation}>
        {/* Large wooden crate with open top - wider and shorter */}
        <RigidBody type="fixed" colliders={false}>
          {/* Crate bottom */}
          <CuboidCollider args={[4, 0.2, 1.5]} position={[0, 0.2, 0]} />
          <mesh castShadow receiveShadow position={[0, 0.2, 0]}>
            <boxGeometry args={[8, 0.4, 3]} />
            <meshStandardMaterial attach="material" color="#8B4513" />
          </mesh>

          {/* Crate sides - use a single geometry for all sides */}
          <CuboidCollider args={[4, 0.5, 0.2]} position={[0, 0.7, 1.3]} />
          <CuboidCollider args={[4, 0.5, 0.2]} position={[0, 0.7, -1.3]} />
          <CuboidCollider args={[0.2, 0.5, 1.5]} position={[-3.8, 0.7, 0]} />
          <CuboidCollider args={[0.2, 0.5, 1.5]} position={[3.8, 0.7, 0]} />

          <group>
            <mesh castShadow receiveShadow position={[0, 0.7, 1.3]}>
              <boxGeometry args={[8, 1, 0.4]} />
              <meshStandardMaterial attach="material" color="#8B4513" />
            </mesh>

            <mesh castShadow receiveShadow position={[0, 0.7, -1.3]}>
              <boxGeometry args={[8, 1, 0.4]} />
              <meshStandardMaterial attach="material" color="#8B4513" />
            </mesh>

            <mesh castShadow receiveShadow position={[-3.8, 0.7, 0]}>
              <boxGeometry args={[0.4, 1, 3]} />
              <meshStandardMaterial attach="material" color="#8B4513" />
            </mesh>

            <mesh castShadow receiveShadow position={[3.8, 0.7, 0]}>
              <boxGeometry args={[0.4, 1, 3]} />
              <meshStandardMaterial attach="material" color="#8B4513" />
            </mesh>
          </group>

          {/* Static paintball canisters using instanced mesh for better performance */}
          {canisterPositions.map((canPos, i) => {
            // Each canPos contains [x, y, z, rotX, rotY, rotZ]
            const [x, y, z, rotX, rotY, rotZ] = canPos;
            return (
              <mesh
                key={`static-canister-${i}`}
                castShadow
                position={[x, y, z]}
                rotation={[rotX * Math.PI, rotY * Math.PI, rotZ * Math.PI]}
              >
                <cylinderGeometry args={[0.15, 0.15, 0.6, 6]} />
                <primitive object={canisterMaterial} attach="material" />
              </mesh>
            );
          })}
        </RigidBody>
      </group>
    );
  }

  // Add a new ReloadZoneMarker component for the canister crate reload zones
  const ReloadZoneMarker = ({ position, rotation = [0, 0, 0] }) => {
    return (
      <group position={position} rotation={rotation}>
        {/* Simple glowing ring with adjustments to prevent z-fighting */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
          <ringGeometry args={[4.5, 5, 32]} />
          <meshBasicMaterial
            attach="material"
            color="#ff6600"
            transparent={true}
            opacity={0.7}
            depthWrite={false}
            side={2} // DoubleSide for visibility from all angles
          />
        </mesh>
      </group>
    );
  };

  // Now, let's update the TexturedCastle component to include the canister crate
  const TexturedCastle = ({
    position,
    color,
    rotation = [0, 0, 0],
    flagCaptured = false,
  }) => {
    return (
      <group position={position} rotation={rotation}>
        {/* Main castle structure */}
        <RigidBody type="fixed" colliders={false}>
          {/* Left wall */}
          <CuboidCollider args={[1, 10, 15]} position={[-15, 10, 0]} />
          <mesh castShadow receiveShadow position={[-15, 10, 0]}>
            <boxGeometry args={[2, 20, 30]} />
            <meshStandardMaterial
              attach="material"
              map={textures.stone}
              color="#a0a0a0"
              roughness={0.7}
            />
          </mesh>

          {/* Right wall */}
          <CuboidCollider args={[1, 10, 15]} position={[15, 10, 0]} />
          <mesh castShadow receiveShadow position={[15, 10, 0]}>
            <boxGeometry args={[2, 20, 30]} />
            <meshStandardMaterial
              attach="material"
              map={textures.stone}
              color="#a0a0a0"
              roughness={0.7}
            />
          </mesh>

          {/* Back wall */}
          <CuboidCollider args={[15, 10, 1]} position={[0, 10, -15]} />
          <mesh castShadow receiveShadow position={[0, 10, -15]}>
            <boxGeometry args={[30, 20, 2]} />
            <meshStandardMaterial
              attach="material"
              map={textures.stone}
              color="#a0a0a0"
              roughness={0.7}
            />
          </mesh>

          {/* Front wall with gate opening */}
          <CuboidCollider args={[6, 10, 1]} position={[-9, 10, 15]} />
          <mesh castShadow receiveShadow position={[-9, 10, 15]}>
            <boxGeometry args={[12, 20, 2]} />
            <meshStandardMaterial
              attach="material"
              map={textures.stone}
              color="#a0a0a0"
              roughness={0.7}
            />
          </mesh>

          <CuboidCollider args={[6, 10, 1]} position={[9, 10, 15]} />
          <mesh castShadow receiveShadow position={[9, 10, 15]}>
            <boxGeometry args={[12, 20, 2]} />
            <meshStandardMaterial
              attach="material"
              map={textures.stone}
              color="#a0a0a0"
              roughness={0.7}
            />
          </mesh>

          {/* Gate top */}
          <CuboidCollider args={[3, 2, 1]} position={[0, 18, 15]} />
          <mesh castShadow receiveShadow position={[0, 18, 15]}>
            <boxGeometry args={[6, 4, 2]} />
            <meshStandardMaterial
              attach="material"
              map={textures.stone}
              color="#a0a0a0"
              roughness={0.7}
            />
          </mesh>
        </RigidBody>

        {/* Flag in courtyard */}
        <FlagPlatform
          position={[0, 0, 0]}
          color={color}
          flagCaptured={flagCaptured}
        />

        {/* Add the paintball canister crate along the back wall */}
        <PaintballCanisterCrate
          position={[0, 0, -12]}
          rotation={[0, 0, 0]}
          color={color}
        />

        {/* Add the reload zone marker on the ground around the canister crate */}
        <ReloadZoneMarker position={[0, 0, -12]} rotation={[0, 0, 0]} />
      </group>
    );
  };

  return (
    <group>
      {/* Ground - Expanded to football field dimensions */}
      <RigidBody type="fixed" position={[0, 0, 0]} colliders={false}>
        {/* Main ground collider - expanded */}
        <CuboidCollider args={[50, 0.5, 150]} position={[0, -0.5, 0]} />

        {/* Main grass field - football field style */}
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
        >
          <planeGeometry args={[100, 300]} />
          <meshStandardMaterial
            attach="material"
            map={textures.grass}
            color="#8eb240"
          />
        </mesh>

        {/* Field markings - white lines */}
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
        >
          <planeGeometry args={[50, 1]} />
          <meshStandardMaterial attach="material" color="white" />
        </mesh>

        {/* Sandy areas near castles - use sand texture */}
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, -120]}
        >
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial
            attach="material"
            map={textures.sand}
            color="#d2b48c"
            roughness={0.9}
          />
        </mesh>

        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 120]}
        >
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial
            attach="material"
            map={textures.sand}
            color="#d2b48c"
            roughness={0.9}
          />
        </mesh>
      </RigidBody>

      {/* Border Walls - Extended for football field */}
      <TexturedBox
        position={[0, 2.0, -150]}
        size={[100, 6, 1]}
        texture="brick"
        color="#a0a0a0"
      />
      <TexturedBox
        position={[0, 2.0, 150]}
        size={[100, 6, 1]}
        texture="brick"
        color="#a0a0a0"
      />
      <TexturedBox
        position={[-50, 2.0, 0]}
        size={[1, 6, 300]}
        texture="brick"
        color="#a0a0a0"
      />
      <TexturedBox
        position={[50, 2.0, 0]}
        size={[1, 6, 300]}
        texture="brick"
        color="#a0a0a0"
      />

      {/* NORTH CASTLE (Red Team) - Entrance facing south (inward) */}
      <TexturedCastle
        position={[0, 0, -120]}
        color="red"
        rotation={[0, 0, 0]}
        flagCaptured={redFlagCaptured}
      />

      {/* SOUTH CASTLE (Blue Team) - Entrance facing north (inward) */}
      <TexturedCastle
        position={[0, 0, 120]}
        color="blue"
        rotation={[0, Math.PI, 0]}
        flagCaptured={blueFlagCaptured}
      />

      {/* CENTRAL COVER OBJECTS */}
      {/* 50 yard line barrier */}
      <TexturedBox
        position={[0, 1.5, 0]}
        size={[20, 3, 3]}
        texture="brick"
        color="#a05050"
      />

      {/* 25 yard line barriers */}
      <TexturedBox
        position={[0, 1.5, -60]}
        size={[15, 3, 3]}
        texture="brick"
        color="#a05050"
      />
      <TexturedBox
        position={[0, 1.5, 60]}
        size={[15, 3, 3]}
        texture="brick"
        color="#a05050"
      />

      {/* Sideline obstacles - left side */}
      <TexturedBox
        position={[-40, 1.5, -90]}
        size={[5, 3, 5]}
        texture="brick"
        color="#a05050"
      />
      <TexturedBox
        position={[-40, 1.5, -30]}
        size={[5, 3, 5]}
        texture="brick"
        color="#a05050"
      />
      <TexturedBox
        position={[-40, 1.5, 30]}
        size={[5, 3, 5]}
        texture="brick"
        color="#a05050"
      />
      <TexturedBox
        position={[-40, 1.5, 90]}
        size={[5, 3, 5]}
        texture="brick"
        color="#a05050"
      />

      {/* Sideline obstacles - right side */}
      <TexturedBox
        position={[40, 1.5, -90]}
        size={[5, 3, 5]}
        texture="brick"
        color="#a05050"
      />
      <TexturedBox
        position={[40, 1.5, -30]}
        size={[5, 3, 5]}
        texture="brick"
        color="#a05050"
      />
      <TexturedBox
        position={[40, 1.5, 30]}
        size={[5, 3, 5]}
        texture="brick"
        color="#a05050"
      />
      <TexturedBox
        position={[40, 1.5, 90]}
        size={[5, 3, 5]}
        texture="brick"
        color="#a05050"
      />

      {/* Wooden crates - scattered for cover */}
      <TexturedBox
        position={[-20, 1, -45]}
        size={[2.5, 2.5, 2.5]}
        texture="wood"
        color="#8B4513"
      />
      <TexturedBox
        position={[20, 1, -45]}
        size={[2.5, 2.5, 2.5]}
        texture="wood"
        color="#8B4513"
      />
      <TexturedBox
        position={[-20, 1, 45]}
        size={[2.5, 2.5, 2.5]}
        texture="wood"
        color="#8B4513"
      />
      <TexturedBox
        position={[20, 1, 45]}
        size={[2.5, 2.5, 2.5]}
        texture="wood"
        color="#8B4513"
      />

      {/* Stacked crates */}
      <TexturedBox
        position={[-20, 3.5, -45]}
        size={[2.5, 2.5, 2.5]}
        texture="wood"
        color="#8B4513"
      />
      <TexturedBox
        position={[20, 3.5, 45]}
        size={[2.5, 2.5, 2.5]}
        texture="wood"
        color="#8B4513"
      />

      {/* Barrels - scattered for cover */}
      <TexturedCylinder
        position={[-15, 1, -75]}
        args={[1, 1, 2, 16]}
        texture="metal"
        color="#555555"
      />
      <TexturedCylinder
        position={[15, 1, -75]}
        args={[1, 1, 2, 16]}
        texture="metal"
        color="#555555"
      />
      <TexturedCylinder
        position={[-15, 1, 75]}
        args={[1, 1, 2, 16]}
        texture="metal"
        color="#555555"
      />
      <TexturedCylinder
        position={[15, 1, 75]}
        args={[1, 1, 2, 16]}
        texture="metal"
        color="#555555"
      />

      {/* Sandbags - for low cover */}
      <TexturedBox
        position={[-30, 0.5, -15]}
        size={[4, 1, 1]}
        texture="sand"
        color="#c2b280"
      />
      <TexturedBox
        position={[30, 0.5, -15]}
        size={[4, 1, 1]}
        texture="sand"
        color="#c2b280"
      />
      <TexturedBox
        position={[-30, 0.5, 15]}
        size={[4, 1, 1]}
        texture="sand"
        color="#c2b280"
      />
      <TexturedBox
        position={[30, 0.5, 15]}
        size={[4, 1, 1]}
        texture="sand"
        color="#c2b280"
      />

      {/* Additional sandbag fortifications */}
      <TexturedBox
        position={[-10, 0.5, -90]}
        size={[15, 1, 1]}
        texture="sand"
        color="#c2b280"
        rotation={[0, Math.PI / 4, 0]}
      />
      <TexturedBox
        position={[10, 0.5, 90]}
        size={[15, 1, 1]}
        texture="sand"
        color="#c2b280"
        rotation={[0, Math.PI / 4, 0]}
      />

      {/* Tire barriers */}
      <TexturedCylinder
        position={[-25, 0.5, 0]}
        args={[2, 2, 1, 16]}
        texture="rubber"
        color="#222222"
      />
      <TexturedCylinder
        position={[25, 0.5, 0]}
        args={[2, 2, 1, 16]}
        texture="rubber"
        color="#222222"
      />
    </group>
  );
}

// Flag platform - grounded at y=0
function FlagPlatform({ position, color, flagCaptured = false }) {
  return (
    <group position={position}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.5, 2]} position={[0, 0.5, 0]} />
        <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
          <cylinderGeometry args={[2, 2, 1, 16]} />
          <meshStandardMaterial attach="material" color="#555555" />
        </mesh>
        <mesh castShadow position={[0, 3, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 5, 8]} />
          <meshStandardMaterial
            attach="material"
            color="#aaaaaa"
            metalness={0.6}
          />
        </mesh>

        {/* Only show flag if not captured */}
        {!flagCaptured && (
          <mesh castShadow position={[0.6, 4.5, 0]}>
            <boxGeometry args={[1.2, 0.8, 0.05]} />
            <meshStandardMaterial attach="material" color={color} />
          </mesh>
        )}
      </RigidBody>

      {/* Add a flag capture zone */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[2, 3, 32]} />
        <meshBasicMaterial
          attach="material"
          color={color}
          transparent={true}
          opacity={0.5}
          depthWrite={false}
          side={2} // DoubleSide for visibility from all angles
        />
      </mesh>
    </group>
  );
}
