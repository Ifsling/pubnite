import Phaser from "phaser"
import Player from "./Player"

export default class HealthUI {
  private scene: Phaser.Scene
  private player: Player
  private container: Phaser.GameObjects.Container
  private healthBar: Phaser.GameObjects.Rectangle
  private healthText: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene
    this.player = player

    this.container = scene.add.container(
      scene.scale.width / 2,
      scene.scale.height - 100
    )
    this.container.setScrollFactor(0).setDepth(999)

    const bg = scene.add.rectangle(0, 0, 220, 30, 0x000000).setOrigin(0.5)
    this.healthBar = scene.add.rectangle(0, 0, 200, 20, 0xff0000).setOrigin(0.5)
    this.healthText = scene.add
      .text(0, 0, "HP: 100", {
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(0.5)

    this.container.add([bg, this.healthBar, this.healthText])
  }

  public update() {
    const hp = this.player.getHealth()
    const percent = Phaser.Math.Clamp(hp / 200, 0, 1)
    this.healthBar.width = 200 * percent
    this.healthText.setText(`HP: ${Math.floor(hp)}`)
  }
}
