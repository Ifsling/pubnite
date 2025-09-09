import * as Phaser from "phaser"
import GameScene from "../scenes/GameScene"
import Enemy from "./Enemy"

export default class PlayerCountUI {
  private scene: GameScene
  private text!: Phaser.GameObjects.Text

  constructor(scene: GameScene) {
    this.scene = scene
    this.createUI()
  }

  private createUI() {
    // Create the text
    this.text = this.scene.add
      .text(0, 0, "Players Left: 0", {
        fontSize: "24px",
        color: "#0a2b3c",
        backgroundColor: "#ffffff",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setPosition(this.scene.scale.width - 250, 16)
  }

  public update(enemy?: Enemy) {
    if (!this.text) return

    const aliveEnemies = this.scene.enemies.filter((e) => e.active).length
    const totalAlive = enemy ? aliveEnemies : 1 + aliveEnemies
    this.text.setText(`Players Left: ${totalAlive}`)
  }
}
