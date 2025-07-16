import Phaser from "phaser"
import Player from "./Player"

export default class GunUI {
  private scene: Phaser.Scene
  private player: Player
  private containers: {
    container: Phaser.GameObjects.Container
    icon: Phaser.GameObjects.Sprite
    closeBtn: Phaser.GameObjects.Text
  }[] = []

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene
    this.player = player

    const startX = scene.scale.width / 2 - 150
    const y = scene.scale.height - 90

    for (let i = 0; i < 3; i++) {
      const container = scene.add
        .container(startX + i * 110 + 30, y + 48)
        .setDepth(999)
        .setScrollFactor(0)

      const bg = scene.add.rectangle(0, 0, 80, 80, 0x222222).setOrigin(0.5)

      const icon = scene.add.sprite(0, 0, "").setOrigin(0.5).setScale(0.5)
      icon.setVisible(false)

      const closeBtn: Phaser.GameObjects.Text = scene.add
        .text(30, -30, "X", {
          fontSize: "20px",
          color: "#ff0000",
        })
        .setOrigin(0.5)
        .setInteractive({ cursor: "pointer" })
        .setVisible(false)

      // Correctly typed arrow function
      closeBtn.on(
        "pointerdown",
        (() => {
          const index: number = i // Capture the current index
          return () => {
            this.player.removeGunAtIndex(index)
          }
        })()
      )

      container.add([bg, icon, closeBtn])

      this.containers.push({
        container,
        icon,
        closeBtn,
      })
    }
  }

  public update() {
    const gunKeys = this.player.getAllGunKeys()
    for (let i = 0; i < 3; i++) {
      const { icon, closeBtn } = this.containers[i]
      const key = gunKeys[i]

      if (key) {
        icon.setTexture(key).setVisible(true)
        closeBtn.setVisible(true)
      } else {
        icon.setVisible(false)
        closeBtn.setVisible(false)
      }
    }
  }
}
