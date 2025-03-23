"use client";
import { useState } from "react";
import styles from "../styles/Home.module.css";
import Lobby from "../components/Lobby";
import Game from "../components/Game";
import Head from "next/head";

export default function Home() {
  const [gameState, setGameState] = useState("lobby"); // 'lobby', 'game', 'scoreboard'
  const [playerName, setPlayerName] = useState("");

  return (
    <div className={styles.container}>
      <Head>
        <title>PaintBlast - Multiplayer Paintball</title>
        <meta
          name="description"
          content="Immersive multiplayer paintball experience"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        {gameState === "lobby" && (
          <Lobby
            onJoinGame={(name) => {
              setPlayerName(name);
              setGameState("game");
            }}
          />
        )}

        {gameState === "game" && (
          <Game
            playerName={playerName}
            onGameEnd={() => setGameState("scoreboard")}
          />
        )}

        {gameState === "scoreboard" && (
          <div className={styles.scoreboard}>
            <h1>Game Over</h1>
            <button onClick={() => setGameState("lobby")}>Back to Lobby</button>
          </div>
        )}
      </main>
    </div>
  );
}
