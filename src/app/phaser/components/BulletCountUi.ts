// src/components/BulletCountUI.ts
import Phaser from "phaser"
import Gun from "./guns/Gun"

export default class BulletCountUI {
  private scene: Phaser.Scene
  private text: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.text = scene.add
      .text(10, 10, "No Gun", {
        fontSize: "18px",
        color: "#fff",
        backgroundColor: "#000",
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(999)
  }

  public update(activeGun: Gun | null): void {
    if (activeGun) {
      this.text.setText(
        `${activeGun.gunType.toUpperCase()}: ${activeGun.ammo}/${
          activeGun.maxAmmo
        }`
      )
    } else {
      this.text.setText("No Gun")
    }
  }
}
