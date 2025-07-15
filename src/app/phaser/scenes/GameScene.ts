import Phaser from "phaser"
import Player from "../components/Player"
import { AddPhysicsItem } from "../HelperFunctions"
import { PreloadAssets } from "../PreloadAssets"

export default class GameScene extends Phaser.Scene {
  player!: Player

  constructor() {
    super("MyScene")
  }

  preload() {
    PreloadAssets(this)
  }

  create() {
    this.add.image(0, 0, "background").setOrigin(0, 0)

    // Replace sprite with full Player class
    this.player = new Player(this, 800, 600)

    AddPhysicsItem(this, "house", 300, 300)
    AddPhysicsItem(this, "stone", 1520, 780)

    this.player.addItemToBag("painkiller")

    // Ground item pickup example
    AddPhysicsItem(this, "pistol", 900, 300, true, true, true, "gun")
    AddPhysicsItem(this, "ak47", 1100, 300, true, true, true, "gun")
    AddPhysicsItem(this, "sniper", 1300, 300, true, true, true, "gun")
    AddPhysicsItem(this, "shotgun", 1500, 300, true, true, true, "gun")
  }

  update() {
    this.player.update()

    // Toggle bag with B key
    if (
      this.input!.keyboard!.checkDown(this.input!.keyboard!.addKey("B"), 250)
    ) {
      this.player.toggleBag()
    }
  }
}
