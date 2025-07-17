import Phaser from "phaser"
import BagUI from "../components/BagUi"
import BulletCountUI from "../components/BulletCountUi"
import GunUI from "../components/GunUi"
import HealthUI from "../components/HealthUi"
import Player from "../components/Player"
import { AddPhysicsItem } from "../HelperFunctions"
import { PreloadAssets } from "../PreloadAssets"

export default class GameScene extends Phaser.Scene {
  player!: Player
  bagUI!: BagUI
  healthUI!: HealthUI
  gunUI!: GunUI
  bulletCountUI!: BulletCountUI

  constructor() {
    super("MyScene")
  }

  preload() {
    PreloadAssets(this)
  }

  create() {
    this.add.image(0, 0, "background").setOrigin(0, 0)
    this.player = new Player(this, 800, 600)
    this.bagUI = new BagUI(this, this.player)
    this.healthUI = new HealthUI(this, this.player)
    this.gunUI = new GunUI(this, this.player)
    this.bulletCountUI = new BulletCountUI(this)

    // Add some initial items to bag
    this.player.addItemToBag("painkiller")
    this.player.addItemToBag("painkiller")
    this.player.addItemToBag("painkiller")

    // Add equipment on ground
    AddPhysicsItem(this, "vest", 1300, 300, true, false, true, "vest")
    AddPhysicsItem(this, "helmet", 500, 300, true, false, true, "helmet")

    // Add guns on ground
    AddPhysicsItem(this, "pistol", 1000, 500, true, false, true, "gun")
    AddPhysicsItem(this, "ak47", 1300, 500, true, false, true, "gun")
    AddPhysicsItem(this, "shotgun", 1600, 500, true, false, true, "gun")
    AddPhysicsItem(this, "sniper", 1900, 500, true, false, true, "gun")

    // Add ammo pickups
    AddPhysicsItem(this, "pistol_ammo", 1000, 400, true, false, true, "ammo")
    AddPhysicsItem(this, "ak47_ammo", 1300, 400, true, false, true, "ammo")
    AddPhysicsItem(this, "shotgun_ammo", 1600, 400, true, false, true, "ammo")
    AddPhysicsItem(this, "sniper_ammo", 1900, 400, true, false, true, "ammo")
  }

  update() {
    this.player.update()
    this.bagUI.update()
    this.healthUI.update()
    this.gunUI.update()
    this.bulletCountUI.update(this.player.getActiveGun())

    // Handle G key for pickup
    if (this.input.keyboard!.checkDown(this.input.keyboard!.addKey("G"), 250)) {
      this.player.tryPickup()
    }
  }
}
