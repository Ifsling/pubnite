import Phaser from "phaser"
import Player from "./Player"

export default class GunUI {
  private scene: Phaser.Scene
  private player: Player
  private containers: Phaser.GameObjects.Container[] = []

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene
    this.player = player

    const startX = scene.scale.width / 2 - 150
    const y = scene.scale.height - 10

    for (let i = 0; i < 3; i++) {
      const container = scene.add.container(startX + i * 110, y)
      container.setScrollFactor(0).setDepth(999)

      const bg = scene.add.rectangle(0, 0, 80, 80, 0x222222).setOrigin(0.5)
      container.add(bg)
      this.containers.push(container)
    }
  }

  public update() {
    const guns = this.player.getAllGunKeys()
    for (let i = 0; i < 3; i++) {
      const container = this.containers[i]
      container.removeAll(true)

      const bg = this.scene.add.rectangle(0, 0, 80, 80, 0x222222).setOrigin(0.5)
      container.add(bg)

      const key = guns[i]
      if (key) {
        const icon = this.scene.add.sprite(0, 0, key).setScale(0.5)
        container.add(icon)

        const close = this.scene.add
          .text(30, -30, "X", {
            fontSize: "20px",
            color: "#ff0000",
            backgroundColor: "#000000",
          })
          .setOrigin(0.5)
          .setInteractive()

        close.on("pointerdown", () => {
          this.player.removeGunAtIndex(i)
        })

        container.add(close)
      }
    }
  }
}
