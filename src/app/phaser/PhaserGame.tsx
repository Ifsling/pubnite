// components/PhaserGame.js
"use client"

import * as Phaser from "phaser"
import { useEffect, useRef, useState } from "react"
import MenuScreen from "./MenuScreen"
import GameScene from "./scenes/GameScene"

type GameStates = "menu" | "gameplay"

export default function PhaserGame() {
  const gameRef = useRef<Phaser.Game | null>(null)
  const [currentGameState, setCurrentGameState] = useState<GameStates>("menu")

  // 🔔 Listen for "go to menu" from Phaser
  useEffect(() => {
    const goToMenu = () => setCurrentGameState("menu")
    if (typeof window !== "undefined") {
      window.addEventListener("PUBNITE_GO_TO_MENU", goToMenu)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("PUBNITE_GO_TO_MENU", goToMenu)
      }
    }
  }, [])

  // Create/destroy Phaser only in gameplay
  useEffect(() => {
    if (currentGameState !== "gameplay" || gameRef.current) return
    if (typeof window === "undefined") return

    const config = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      dom: { createContainer: true },
      scene: [GameScene],
      parent: "phaser-container",
    }

    gameRef.current = new Phaser.Game(config)

    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const game = gameRef.current
      if (!game) return
      game.scale.resize(width, height)
      const scene = game.scene.getAt(0)
      if (scene?.cameras?.main) scene.cameras.main.setSize(width, height)
    }

    window.addEventListener("resize", handleResize)

    // Cleanup when leaving gameplay (e.g., back to menu)
    return () => {
      window.removeEventListener("resize", handleResize)
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [currentGameState])

  if (currentGameState === "menu") {
    return <MenuScreen onStartGame={() => setCurrentGameState("gameplay")} />
  }

  return <div id="phaser-container" className="w-full h-screen" />
}
