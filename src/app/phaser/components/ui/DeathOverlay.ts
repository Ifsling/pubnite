// src/components/DeathOverlay.ts
import GameScene from "../../scenes/GameScene"
import Enemy from "../Enemy"

export default class DeathOverlay {
  private scene: GameScene
  private overlay: Phaser.GameObjects.Rectangle | null = null
  private resultText: Phaser.GameObjects.Text | null = null
  private playerCountText: Phaser.GameObjects.Text | null = null
  private lobbyButton: Phaser.GameObjects.Text | null = null

  constructor(
    scene: GameScene,
    enemies: Enemy[],
    isWinner: boolean,
    initialTotal: number
  ) {
    this.scene = scene

    // Destroy any existing overlays
    this.scene.children.list
      .filter((obj) => (obj as any).isDeathOverlayElement)
      .forEach((obj) => obj.destroy())

    // Transparent black background
    this.overlay = this.scene.add
      .rectangle(
        0,
        0,
        this.scene.scale.width,
        this.scene.scale.height,
        0x000000,
        0.8
      )
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(999)
    ;(this.overlay as any).isDeathOverlayElement = true

    const message = isWinner
      ? "Winner Winner Chicken Dinner"
      : "Loser Loser Veggie Dinner"
    const color = isWinner ? "#FFD700" : "#ffffff"

    this.resultText = this.scene.add
      .text(80, 80, message, {
        fontFamily: "BRF",
        fontSize: "64px",
        color,
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(1000)
    ;(this.resultText as any).isDeathOverlayElement = true

    const playerRank = isWinner ? 1 : 1 + enemies.filter((e) => e.active).length
    this.playerCountText = this.scene.add
      .text(0, 80, `#${playerRank}/${initialTotal}`, {
        fontFamily: "BRF",
        fontSize: "40px",
        color: "#ff4444",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000)
    ;(this.playerCountText as any).isDeathOverlayElement = true

    this.lobbyButton = this.scene.add
      .text(0, 0, "Go to Lobby", {
        fontSize: "36px",
        backgroundColor: "#ffffff",
        color: "#000000",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive()
      .setDepth(1000)
    ;(this.lobbyButton as any).isDeathOverlayElement = true

    this.lobbyButton.on("pointerover", () => {
      this.lobbyButton!.setStyle({ backgroundColor: "#dddddd" })
    })
    this.lobbyButton.on("pointerout", () => {
      this.lobbyButton!.setStyle({ backgroundColor: "#ffffff" })
    })
    this.lobbyButton.on("pointerdown", () => {
      this.destroy()
      scene.totalPlayers = 0
      this.scene.scene.restart()
    })

    this.updatePosition()
    this.scene.scale.on("resize", this.updatePosition, this)

    // auto-cleanup when scene shuts down
    this.scene.events.once("shutdown", this.destroy, this)
  }

  private updatePosition() {
    if (
      !this.overlay ||
      !this.resultText ||
      !this.playerCountText ||
      !this.lobbyButton
    )
      return
    const { width, height } = this.scene.scale

    if (this.overlay.active) {
      this.overlay.setSize(width, height)
    }
    if (this.resultText.active) {
      this.resultText.setPosition(80, 80)
    }
    if (this.playerCountText.active) {
      this.playerCountText.setPosition(width - 80, 80)
    }
    if (this.lobbyButton.active) {
      this.lobbyButton.setPosition(width / 2, height - 100)
    }
  }

  public destroy() {
    this.scene.scale.off("resize", this.updatePosition, this)
    this.overlay?.destroy()
    this.overlay = null
    this.resultText?.destroy()
    this.resultText = null
    this.playerCountText?.destroy()
    this.playerCountText = null
    this.lobbyButton?.destroy()
    this.lobbyButton = null
  }
}
