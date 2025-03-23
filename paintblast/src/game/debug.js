import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import * as THREE from "three";

export default function PhysicsDebug({ debugMode = false }) {
  const { scene } = useThree();
  const { world } = useRapier();
  const [debugObjects, setDebugObjects] = useState([]);

  useEffect(() => {
    if (!debugMode) return;

    const debugGroup = new THREE.Group();
    debugGroup.name = "physics-debug";
    scene.add(debugGroup);

    const updateDebug = () => {
      // Clear previous debug objects
      while (debugGroup.children.length > 0) {
        const child = debugGroup.children[0];
        child.geometry?.dispose();
        child.material?.dispose();
        debugGroup.remove(child);
      }

      // Add collider debug objects
      if (world) {
        // Safely access colliders
        try {
          const colliders = world.colliders();
          if (colliders) {
            colliders.forEach((collider) => {
              if (!collider || !collider.type) return; // Skip if collider is invalid

              let mesh;
              const position = collider.translation();
              const rotation = collider.rotation();

              // Create different geometries based on collider type
              switch (collider.type) {
                case 0: // Cuboid
                  const halfExtents = collider.halfExtents();
                  const boxGeometry = new THREE.BoxGeometry(
                    halfExtents.x * 2,
                    halfExtents.y * 2,
                    halfExtents.z * 2
                  );
                  mesh = new THREE.Mesh(
                    boxGeometry,
                    new THREE.MeshBasicMaterial({
                      color: 0x00ff00,
                      wireframe: true,
                    })
                  );
                  break;
                case 1: // Ball
                  const radius = collider.radius();
                  const sphereGeometry = new THREE.SphereGeometry(
                    radius,
                    16,
                    16
                  );
                  mesh = new THREE.Mesh(
                    sphereGeometry,
                    new THREE.MeshBasicMaterial({
                      color: 0xff0000,
                      wireframe: true,
                    })
                  );
                  break;
                case 2: // Capsule
                  const capsuleRadius = collider.radius();
                  const halfHeight = collider.halfHeight();
                  const capsuleGeometry = new THREE.CapsuleGeometry(
                    capsuleRadius,
                    halfHeight * 2,
                    8,
                    16
                  );
                  mesh = new THREE.Mesh(
                    capsuleGeometry,
                    new THREE.MeshBasicMaterial({
                      color: 0x0000ff,
                      wireframe: true,
                    })
                  );
                  break;
                case 3: // Cylinder
                  const cylinderRadius = collider.radius();
                  const cylinderHalfHeight = collider.halfHeight();
                  const cylinderGeometry = new THREE.CylinderGeometry(
                    cylinderRadius,
                    cylinderRadius,
                    cylinderHalfHeight * 2,
                    16
                  );
                  mesh = new THREE.Mesh(
                    cylinderGeometry,
                    new THREE.MeshBasicMaterial({
                      color: 0xffff00,
                      wireframe: true,
                    })
                  );
                  break;
                default:
                  // Unknown collider type
                  return;
              }

              if (mesh) {
                mesh.position.set(position.x, position.y, position.z);
                mesh.quaternion.set(
                  rotation.x,
                  rotation.y,
                  rotation.z,
                  rotation.w
                );
                debugGroup.add(mesh);
              }
            });
          }
        } catch (error) {
          console.error("Error rendering physics debug:", error);
        }
      }
    };

    // Initial update
    updateDebug();

    // Update on each physics step
    const unsubscribe = world.on("physics-step", updateDebug);

    return () => {
      unsubscribe();
      scene.remove(debugGroup);
    };
  }, [scene, world, debugMode]);

  return null;
}
