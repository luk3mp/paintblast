import { useRef, useState, useEffect, forwardRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Vector3 } from "three";

// Default paintball gun model
const PaintballGun = forwardRef(
  ({ position, rotation, scale, isFirstPerson }, ref) => {
    const { scene } = useThree();
    const modelRef = useRef();

    // Animation state
    const [recoil, setRecoil] = useState(0);

    // Forward ref to parent
    useEffect(() => {
      if (ref) {
        ref.current = modelRef.current;
      }
    }, [ref]);

    // Handle recoil animation
    useFrame((state, delta) => {
      if (recoil > 0) {
        setRecoil(Math.max(0, recoil - delta * 5));

        if (modelRef.current) {
          // Apply recoil animation
          modelRef.current.position.z = isFirstPerson
            ? -0.7 - recoil * 0.1
            : 0.5;
        }
      }
    });

    // Trigger recoil animation
    const triggerRecoil = () => {
      setRecoil(1);
    };

    // Expose triggerRecoil to parent via ref
    useEffect(() => {
      if (ref && modelRef.current) {
        modelRef.current.triggerRecoil = triggerRecoil;
      }
    }, [ref]);

    return (
      <group
        ref={modelRef}
        position={position}
        rotation={rotation}
        scale={scale}
      >
        {/* Gun body */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.2, 1]} />
          <meshStandardMaterial color="#333333" roughness={0.4} />
        </mesh>

        {/* Gun handle */}
        <mesh castShadow receiveShadow position={[0, -0.25, 0.2]}>
          <boxGeometry args={[0.15, 0.3, 0.2]} />
          <meshStandardMaterial color="#222222" roughness={0.4} />
        </mesh>

        {/* Gun barrel */}
        <mesh castShadow receiveShadow position={[0, 0, -0.6]}>
          <cylinderGeometry
            args={[0.05, 0.05, 0.5, 16]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <meshStandardMaterial color="#444444" roughness={0.4} />
        </mesh>

        {/* Gun hopper (paintball container) */}
        <mesh castShadow receiveShadow position={[0, 0.25, 0.1]}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial
            color="#666666"
            roughness={0.4}
            transparent
            opacity={0.8}
          />
        </mesh>
      </group>
    );
  }
);

// Add display name to fix the ESLint error
PaintballGun.displayName = "PaintballGun";

// Paintball projectile
export function Paintball({ position, velocity, color = "#ff4500" }) {
  const paintballRef = useRef();
  const [alive, setAlive] = useState(true);

  // Move paintball based on velocity
  useFrame((state, delta) => {
    if (paintballRef.current && alive) {
      // Apply velocity
      paintballRef.current.position.x += velocity[0] * delta * 30;
      paintballRef.current.position.y += velocity[1] * delta * 30;
      paintballRef.current.position.z += velocity[2] * delta * 30;

      // Check if paintball has traveled too far
      const distanceSquared =
        paintballRef.current.position.x * paintballRef.current.position.x +
        paintballRef.current.position.y * paintballRef.current.position.y +
        paintballRef.current.position.z * paintballRef.current.position.z;

      if (distanceSquared > 10000) {
        // 100 units distance
        setAlive(false);
      }
    }
  });

  if (!alive) return null;

  return (
    <mesh ref={paintballRef} position={position} castShadow>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export default PaintballGun;
