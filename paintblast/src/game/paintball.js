import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, Quaternion, Matrix4 } from "three";
import { RigidBody, BallCollider } from "@react-three/rapier";

// Constants for performance optimization
const MAX_LIFETIME = 3; // seconds
const MAX_SPLAT_LIFETIME = 5; // Reduced from 10 to 5 seconds
const PAINTBALL_SIZE = 0.06;
const SPLAT_SIZE = 0.4;
const INITIAL_VELOCITY = 60;
const PHYSICS_STEPS = 2; // Frequency of physics calculations

export default function Paintball({
  position,
  direction,
  color = "#ff0000",
  onHit = () => {},
  id,
}) {
  const paintballRef = useRef();
  const lifetime = useRef(0);
  const [splat, setSplat] = useState(false);
  const [splatPosition, setSplatPosition] = useState([0, 0, 0]);
  const [splatRotation, setSplatRotation] = useState([0, 0, 0]);
  const splatLifetime = useRef(0);
  const hasCollided = useRef(false);
  const frameCount = useRef(0);

  // Optimize initial velocity calculation
  const initialVelocity = useRef(
    new Vector3(...direction).normalize().multiplyScalar(INITIAL_VELOCITY)
  );

  // Set up self-destruction timer
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasCollided.current) {
        onHit(id, null);
      }
    }, MAX_LIFETIME * 1000);

    return () => clearTimeout(timeout);
  }, [id, onHit]);

  // More efficient frame update logic
  useFrame((state, delta) => {
    frameCount.current++;

    if (splat) {
      // Handle splat lifetime
      splatLifetime.current += delta;
      if (splatLifetime.current > MAX_SPLAT_LIFETIME) {
        onHit(id, null); // Remove the splat completely
      }
      return;
    }

    if (paintballRef.current) {
      lifetime.current += delta;

      // Handle lifetime expiration
      if (lifetime.current > MAX_LIFETIME) {
        onHit(id, null);
      }
    }
  });

  // Optimized collision handler
  const handleCollision = (event) => {
    if (hasCollided.current || splat) return;

    // Set collision flag immediately to prevent duplicate processing
    hasCollided.current = true;

    // Get position from the rigid body
    const pos = paintballRef.current.translation();

    // Extract collision normal (default to up if not available)
    let normal = [0, 1, 0];
    if (event.manifold) {
      normal = [
        event.manifold.normal.x,
        event.manifold.normal.y,
        event.manifold.normal.z,
      ];
    }

    // Skip ground splats for better performance (y-normal close to 1 and y position close to 0)
    const isGround = Math.abs(normal[1]) > 0.9 && Math.abs(pos.y) < 0.2;
    if (isGround) {
      onHit(id, null);
      return;
    }

    // Calculate proper rotation to align with the surface - only if not ground
    const normalVector = new Vector3(normal[0], normal[1], normal[2]);
    const upVector = new Vector3(0, 1, 0);

    // Only calculate rotation if normal is not zero
    if (normalVector.lengthSq() > 0.001) {
      // Create a quaternion that rotates from up vector to normal vector
      const quaternion = new Quaternion().setFromUnitVectors(
        upVector,
        normalVector.normalize()
      );

      // Convert quaternion to Euler angles
      const euler = new Vector3();
      const matrix = new Matrix4().makeRotationFromQuaternion(quaternion);
      euler.setFromRotationMatrix(matrix);

      setSplatRotation([euler.x, euler.y, euler.z]);
    }

    // Create splat at collision point - offset slightly to prevent z-fighting
    setSplat(true);

    // Move the splat slightly along the normal to prevent z-fighting
    const offsetPos = [
      pos.x + normal[0] * 0.01,
      pos.y + normal[1] * 0.01,
      pos.z + normal[2] * 0.01,
    ];
    setSplatPosition(offsetPos);

    // Notify parent component about the hit
    onHit(id, {
      position: offsetPos,
      normal: normal,
      color: color,
    });
  };

  // Use simplified mesh for better performance
  return (
    <>
      {!splat ? (
        // Regular paintball in flight with physics
        <RigidBody
          ref={paintballRef}
          position={position}
          linearVelocity={[
            initialVelocity.current.x,
            initialVelocity.current.y,
            initialVelocity.current.z,
          ]}
          angularDamping={0.5}
          linearDamping={0.15}
          colliders={false}
          gravityScale={1.5}
          onCollisionEnter={handleCollision}
          sensor={false}
          type="dynamic"
          ccd={true}
        >
          <BallCollider args={[PAINTBALL_SIZE]} />
          <mesh castShadow>
            <sphereGeometry args={[PAINTBALL_SIZE, 6, 6]} />
            <meshStandardMaterial attach="material" color={color} />
          </mesh>
        </RigidBody>
      ) : (
        // Splat effect when hitting something - simplified geometry
        <mesh position={splatPosition} rotation={splatRotation}>
          <circleGeometry args={[SPLAT_SIZE, 12]} />
          <meshStandardMaterial
            attach="material"
            color={color}
            transparent={true}
            opacity={0.9}
            emissive={color}
            emissiveIntensity={0.5}
            depthWrite={false}
            depthTest={true}
          />
        </mesh>
      )}
    </>
  );
}
