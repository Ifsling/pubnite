import * as Phaser from "phaser"
import Player from "../Player"
import GunUI from "./GunUi"
import HealthUI from "./HealthUi"

export default class GunAndHealthUi {
  private scene: Phaser.Scene
  private player: Player
  private mainContainer: Phaser.GameObjects.Container
  private healthUI: HealthUI
  private gunUI: GunUI

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene
    this.player = player

    // Create a main container to hold both UIs
    this.mainContainer = scene.add.container(0, 0)
    this.mainContainer.setScrollFactor(0).setDepth(999)

    // Create and add HealthUI to the main container
    this.healthUI = new HealthUI(scene, player)
    this.mainContainer.add(this.healthUI.getContainer())

    // Create and add GunUI to the main container
    this.gunUI = new GunUI(scene, player)
    this.mainContainer.add(this.gunUI.getContainer())

    // Position the UI elements relative to each other, stacking them vertically
    const healthHeight = this.healthUI.getContainer().height
    const gunHeight = this.gunUI.getContainer().height
    const padding = 20

    // Position the health bar above the gun UI.
    // We use a negative y value to place it "up" from the container's center.
    this.healthUI.getContainer().setPosition(0, -(gunHeight / 2) - padding)

    // Position the gun UI at the center of the main container's x-axis,
    // and slightly below its center y-axis.
    this.gunUI.getContainer().setPosition(0, healthHeight / 2)

    // Initial positioning and set up resize listener
    this.updatePosition()
    this.scene.scale.on("resize", this.updatePosition, this)
  }

  public updatePosition() {
    const totalHeight = this.mainContainer.height
    const x = this.scene.scale.width / 2
    const y = this.scene.scale.height - 90 - totalHeight / 2
    this.mainContainer.setPosition(x, y)
  }

  public update() {
    this.healthUI.update()
    this.gunUI.update()
  }
}
