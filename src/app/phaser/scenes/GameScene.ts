import { getOneSpawnLocationWithinMap } from "@/app/utils"
import Phaser from "phaser"
import BagUI from "../components/BagUi"
import BulletCountUI from "../components/BulletCountUi"
import DeathOverlay from "../components/DeathOverlay"
import Enemy from "../components/Enemy"
import GunUI from "../components/GunUi"
import HealthUI from "../components/HealthUi"
import Player from "../components/Player"
import { AddPhysicsItem, handleCollisions } from "../HelperFunctions"
import { createMap, spawnableLocations } from "../map/Map"
import { PreloadAssets } from "../PreloadAssets"

export default class GameScene extends Phaser.Scene {
  map!: Phaser.Tilemaps.Tilemap
  player!: Player
  bagUI!: BagUI
  healthUI!: HealthUI
  gunUI!: GunUI
  bulletCountUI!: BulletCountUI
  playerCountText!: Phaser.GameObjects.Text
  enemies: Enemy[] = []
  playerBullets!: Phaser.Physics.Arcade.Group
  enemyBullets!: Phaser.Physics.Arcade.Group

  constructor() {
    super("MyScene")
  }

  preload() {
    PreloadAssets(this)
  }

  create() {
    const {
      map,
      tileset,
      backgroundLayer,
      trees,
      water,
      houses,
      road,
      bridge,
      bush,
      stones,
    } = createMap(this)
    this.map = map

    const location = getOneSpawnLocationWithinMap()
    console.log(location)
    const locations = spawnableLocations()

    this.player = new Player(this, 450, 450)
    this.bagUI = new BagUI(this, this.player)
    this.healthUI = new HealthUI(this, this.player)
    this.gunUI = new GunUI(this, this.player)
    this.bulletCountUI = new BulletCountUI(this)
    this.playerBullets = this.physics.add.group()
    this.enemyBullets = this.physics.add.group()

    handleCollisions(this, {
      houses,
      water,
      trees,
      bush,
      stones,
    })

    // Add some initial items to bag
    this.player.addItemToBag("painkiller")
    this.player.addItemToBag("painkiller")
    this.player.addItemToBag("painkiller")

    // Add equipment on ground
    AddPhysicsItem(this, "vest", 1300, 300, true, false, true, "vest")
    AddPhysicsItem(this, "helmet", 500, 300, true, false, true, "helmet")

    // Add guns on ground
    AddPhysicsItem(this, "pistol", 1000, 500 + 500, true, false, true, "gun")
    AddPhysicsItem(this, "ak47", 1300, 500 + 500, true, false, true, "gun")
    AddPhysicsItem(this, "shotgun", 1600, 500 + 500, true, false, true, "gun")
    AddPhysicsItem(this, "sniper", 1900, 500 + 500, true, false, true, "gun")

    // Add ammo pickups
    AddPhysicsItem(
      this,
      "pistol_ammo",
      1000,
      400 + 500,
      true,
      false,
      true,
      "ammo"
    )
    AddPhysicsItem(
      this,
      "ak47_ammo",
      1300,
      400 + 500,
      true,
      false,
      true,
      "ammo"
    )
    AddPhysicsItem(
      this,
      "shotgun_ammo",
      1600,
      400 + 500,
      true,
      false,
      true,
      "ammo"
    )
    AddPhysicsItem(
      this,
      "sniper_ammo",
      1900,
      400 + 500,
      true,
      false,
      true,
      "ammo"
    )

    this.enemies = [
      new Enemy(this, 1000, 800, this.player),
      new Enemy(this, 1400, 900, this.player),
      new Enemy(this, 1600, 1000, this.player),
    ]

    this.playerCountText = this.add
      .text(16, 16, "", {
        fontSize: "24px",
        color: "#0a2b3c",
        backgroundColor: "#ffffff",
        padding: { x: 8, y: 4 },
      })
      // .setOrigin(1, 1) // Align text to the top right
      .setScrollFactor(0)
      .setPosition(screen.width - 250, 16)

    this.updatePlayerCountUI()

    // Events listening and handling
    this.events.on("enemy-killed", (enemy: Enemy) => {
      this.updatePlayerCountUI(enemy)
    })

    this.events.on("player-dead", () => {
      new DeathOverlay(this, this.enemies)
    })

    this.cameras.main.startFollow(this.player)
  }

  update(time: number, delta: number) {
    this.player.update()
    this.bagUI.update()
    this.healthUI.update()
    this.gunUI.update()
    this.bulletCountUI.update(this.player.getActiveGun())

    this.enemies.forEach((enemy) => {
      if (enemy.active) {
        enemy.update(time, delta)
      }
    })

    // Handle G key for pickup
    if (this.input.keyboard!.checkDown(this.input.keyboard!.addKey("G"), 250)) {
      this.player.tryPickup()
    }
  }

  private updatePlayerCountUI(enemy?: Enemy) {
    if (enemy) {
      const aliveEnemies = this.enemies.filter((e) => e.active).length

      const totalAlive = aliveEnemies
      this.playerCountText.setText(`Players Left: ${totalAlive}`)
    } else {
      const aliveEnemies = this.enemies.filter((e) => e.active).length

      const totalAlive = 1 + aliveEnemies // 1 player + enemies
      this.playerCountText.setText(`Players Left: ${totalAlive}`)
    }
  }
}
