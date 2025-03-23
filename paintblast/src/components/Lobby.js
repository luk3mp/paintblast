import { useState } from "react";
import styles from "../styles/Lobby.module.css";

export default function Lobby({ onJoinGame }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }
    onJoinGame(name);
  };

  return (
    <div className={styles.lobby}>
      <div className={styles.container}>
        <h1 className={styles.title}>PaintBlast</h1>
        <h2 className={styles.subtitle}>Multiplayer Paintball</h2>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            placeholder="Enter your callsign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.input}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button}>
            Join Game
          </button>
        </form>

        <div className={styles.info}>
          <h3>How to Play</h3>
          <ul>
            <li>WASD to move</li>
            <li>Mouse to aim</li>
            <li>Left click to shoot</li>
            <li>R to reload</li>
            <li>Shift to sprint</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
