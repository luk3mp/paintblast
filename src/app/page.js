"use client";
import { useState, useEffect } from "react";
import styles from "../styles/Home.module.css";
import Lobby from "../components/Lobby";
import Game from "../components/Game";
import QueueStatus from "../components/QueueStatus";
import {
  connectSocket,
  disconnectSocket,
  getConnectionState,
} from "../lib/socket";
import { IS_MULTIPLAYER } from "../lib/config";
import { EVENTS, addEventListener } from "../lib/events";
import Head from "next/head";

export default function Home() {
  const [gameState, setGameState] = useState("lobby"); // 'lobby', 'queue', 'game', 'scoreboard'
  const [playerName, setPlayerName] = useState("");
  const [isMultiplayerGame, setIsMultiplayerGame] = useState(IS_MULTIPLAYER);

  // Clean up socket connection on component unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  // Set up queue state listener
  useEffect(() => {
    // Handle connection state changes
    const removeConnectionListener = addEventListener(
      EVENTS.CONNECTION_STATE_CHANGE,
      (data) => {
        if (data.state === "queued" && gameState !== "queue") {
          setGameState("queue");
        } else if (data.state === "connected" && gameState === "queue") {
          setGameState("game");
        }
      }
    );

    // Handle queue ready events
    const removeQueueReadyListener = addEventListener(
      EVENTS.QUEUE_READY,
      () => {
        setGameState("game");
      }
    );

    // Handle game over events
    const removeGameOverListener = addEventListener(EVENTS.GAME_OVER, () => {
      setGameState("scoreboard");
    });

    return () => {
      removeConnectionListener();
      removeQueueReadyListener();
      removeGameOverListener();
    };
  }, [gameState]);

  const handleJoinGame = (name, multiplayer = false) => {
    setPlayerName(name);
    setIsMultiplayerGame(multiplayer);

    if (multiplayer) {
      // For multiplayer, connect to the socket if not already connected
      connectSocket({ multiplayer: true });

      // Check connection state
      const connectionState = getConnectionState();

      if (connectionState === "queued") {
        setGameState("queue");
      } else {
        setGameState("game");
      }
    } else {
      // For single player, just start the game
      setGameState("game");
    }
  };

  const handleCancelQueue = () => {
    disconnectSocket();
    setGameState("lobby");
  };

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
        {gameState === "lobby" && <Lobby onJoinGame={handleJoinGame} />}

        {gameState === "queue" && (
          <QueueStatus
            onCancel={handleCancelQueue}
            onJoinGame={() => setGameState("game")}
          />
        )}

        {gameState === "game" && (
          <Game
            playerName={playerName}
            isMultiplayer={isMultiplayerGame}
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

      <a
        target="_blank"
        href="https://jam.pieter.com"
        style={{
          fontFamily: "system-ui, sans-serif",
          position: "fixed",
          bottom: "-1px",
          right: "-1px",
          padding: "7px",
          fontSize: "14px",
          fontWeight: "bold",
          background: "#fff",
          color: "#000",
          textDecoration: "none",
          zIndex: 10000,
          borderTopLeftRadius: "12px",
          border: "1px solid #fff",
        }}
      >
        🕹️ Vibe Jam 2025
      </a>
    </div>
  );
}
