import Phaser from "phaser"
import Player from "./Player"

export default class BagUI {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private player: Player
  private isVisible: boolean = false
  private toggleKey: Phaser.Input.Keyboard.Key

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene
    this.player = player

    this.toggleKey = scene!.input!.keyboard!.addKey("B")
    this.container = scene.add
      .container(scene.scale.width - 400, 0) // position it 400px from right
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(1000)

    this.createUI()
  }

  private createUI() {
    const bg = this.scene.add
      .rectangle(0, 0, 400, this.scene.scale.height, 0x222222, 0.95)
      .setOrigin(0, 0)

    const title = this.scene.add.text(10, 10, "Bag Items", {
      fontSize: "20px",
      color: "#ffffff",
    })

    const close = this.scene.add
      .text(390, 10, "X", {
        // 390 because container width is 400
        fontSize: "20px",
        color: "#ff5555",
      })
      .setOrigin(1, 0)
      .setInteractive()
      .on("pointerdown", () => this.toggle())

    this.container.add([bg, title, close])
  }

  public update() {
    if (Phaser.Input.Keyboard.JustDown(this.toggleKey)) {
      this.toggle()
    }
  }

  public toggle() {
    this.isVisible = !this.isVisible
    this.container.setVisible(this.isVisible)

    if (this.isVisible) {
      this.populateItems()
    }
  }

  private populateItems() {
    // Remove old items (keep first 3: bg, title, close)
    this.container
      .getAll()
      .slice(3)
      .forEach((child) => child.destroy())

    const items = this.player.getBagItems()
    console.log(items)
    items.forEach((key, index) => {
      const y = 50 + index * 60

      const icon = this.scene.add
        .sprite(10, y, key)
        .setScale(0.5)
        .setOrigin(0, 0.5)

      const name = this.scene.add.text(60, y - 10, key, {
        fontSize: "14px",
        color: "#ffffff",
      })

      const containerWidth = 400

      const throwBtn = this.scene.add
        .text(containerWidth - 10, y - 10, "THROW", {
          fontSize: "14px",
          color: "#ffffff",
          backgroundColor: "#aa0000",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(1, 0) // anchor to top-right
        .setInteractive()
        .on("pointerdown", () => {
          this.player.removeItemFromBag(key)
          this.populateItems()
        })

      const useBtn = this.scene.add
        .text(containerWidth - 80, y - 10, "USE", {
          fontSize: "14px",
          color: "#ffffff",
          backgroundColor: "#00aa00",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(1, 0) // anchor to top-right
        .setInteractive()
        .on("pointerdown", () => {
          console.log("Used", key)
        })

      this.container.add([icon, name, useBtn, throwBtn])
    })
  }
}
