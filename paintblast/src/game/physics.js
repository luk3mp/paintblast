import { useEffect } from "react";
import { useRapier } from "@react-three/rapier";

export function usePhysics() {
  const { rapier, world } = useRapier();

  // Raycast function for hit detection
  const raycast = (origin, direction, maxDistance = 100) => {
    const rayOrigin = { x: origin[0], y: origin[1], z: origin[2] };
    const rayDir = { x: direction[0], y: direction[1], z: direction[2] };

    const ray = new rapier.Ray(rayOrigin, rayDir);
    const hit = world.castRay(ray, maxDistance, true);

    if (hit) {
      return {
        distance: hit.toi,
        point: [
          rayOrigin.x + rayDir.x * hit.toi,
          rayOrigin.y + rayDir.y * hit.toi,
          rayOrigin.z + rayDir.z * hit.toi,
        ],
        normal: [hit.normal.x, hit.normal.y, hit.normal.z],
        collider: hit.collider,
      };
    }

    return null;
  };

  return {
    raycast,
  };
}
