// src/components/PlayerCountUI.ts
import * as Phaser from "phaser"
import GameScene from "../../scenes/GameScene"

export default class PlayerCountUI {
  private scene: GameScene
  private text!: Phaser.GameObjects.Text
  private marginX = 16
  private marginY = 16
  private handleResizeBound: ((gameSize: Phaser.Structs.Size) => void) | null =
    null

  constructor(scene: GameScene) {
    this.scene = scene
    this.createUI()
    this.bindResize()
  }

  private createUI() {
    this.text = this.scene.add
      .text(0, 0, "Players Left: 1", {
        fontSize: "24px",
        color: "#0a2b3c",
        backgroundColor: "#ffffff",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setOrigin(1, 0) // anchor to top-right corner
    this.reposition()
  }

  private bindResize() {
    // Bind once; keep reference so we can unbind on shutdown
    this.handleResizeBound = (gameSize: Phaser.Structs.Size) => {
      this.reposition(gameSize.width, gameSize.height)
    }
    this.scene.scale.on("resize", this.handleResizeBound, this)

    // Clean up when scene shuts down to avoid memory leaks
    this.scene.events.once("shutdown", () => {
      if (this.handleResizeBound) {
        this.scene.scale.off("resize", this.handleResizeBound, this)
        this.handleResizeBound = null
      }
    })
  }

  private reposition(w?: number, h?: number) {
    const width = w ?? this.scene.scale.width
    const height = h ?? this.scene.scale.height
    // Because origin is (1, 0), just place at the right margin
    this.text.setPosition(width - this.marginX, this.marginY)
  }

  public update() {
    if (!this.text || !this.scene.player) return
    const aliveEnemies = this.scene.enemies.filter((e) => e.active).length
    const totalAlive = (this.scene.player.isAlive ? 1 : 0) + aliveEnemies
    this.text.setText(`Players Left: ${totalAlive}`)
  }
}
