import { useEffect, useState } from "react";

export default function PointerLockManager({ isEnabled, onLockChange }) {
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!isEnabled) return;

    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    const handleClick = () => {
      if (!isLocked) {
        console.log("Requesting pointer lock...");
        canvas.requestPointerLock();
      }
    };

    const handleLockChange = () => {
      const newLockState = document.pointerLockElement === canvas;
      console.log("Pointer lock state changed:", newLockState);
      setIsLocked(newLockState);
      onLockChange(newLockState);

      // If lock was lost, try to reacquire it when the user clicks again
      if (!newLockState) {
        const handleReacquire = () => {
          canvas.requestPointerLock();
          window.removeEventListener("click", handleReacquire);
        };
        window.addEventListener("click", handleReacquire);
      }
    };

    // Add event listeners
    canvas.addEventListener("click", handleClick);
    document.addEventListener("pointerlockchange", handleLockChange);

    return () => {
      canvas.removeEventListener("click", handleClick);
      document.removeEventListener("pointerlockchange", handleLockChange);
    };
  }, [isEnabled, isLocked, onLockChange]);

  return null; // This is a non-visual component
}
