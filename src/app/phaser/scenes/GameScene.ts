import { getOneSpawnLocationWithinMap } from "@/src/app/utils"
import * as Phaser from "phaser"
import BagUI from "../components/BagUi"
import BulletCountUI from "../components/BulletCountUi"
import DeathOverlay from "../components/DeathOverlay"
import Enemy from "../components/Enemy"
import GunUI from "../components/GunUi"
import HealthUI from "../components/HealthUi"
import Player from "../components/Player"
import PlayerCountUI from "../components/PlayerCountUi"
import RoomManager from "../components/RoomManager"
import SpreadHouseEntries from "../components/SpreadHouseEntries"
import {
  COLLECTABLE_SPAWN_CHANCE,
  COLLECTABLES,
  houseEntryPoints,
  MAP_SCALE_FACTOR,
  NO_OF_ENEMIES,
} from "../Constants"
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
  playerCountUI!: PlayerCountUI
  enemies: Enemy[] = []
  playerBullets!: Phaser.Physics.Arcade.Group
  enemyBullets!: Phaser.Physics.Arcade.Group
  roomManager!: RoomManager
  roomsInformation: {
    point: [x: number, y: number]
    room_type: string
    looted: boolean
    noOfItemsLooted: number
  }[] = []

  outsideColliders: Phaser.Physics.Arcade.Collider[] = []

  public static totalPlayers: number = 0

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

    this.player = new Player(this, 1500, 3400)
    this.bagUI = new BagUI(this, this.player)
    this.healthUI = new HealthUI(this, this.player)
    this.gunUI = new GunUI(this, this.player)
    this.bulletCountUI = new BulletCountUI(this)
    this.playerBullets = this.physics.add.group()
    this.enemyBullets = this.physics.add.group()
    this.playerCountUI = new PlayerCountUI(this)
    this.roomManager = new RoomManager(this)

    // ---------- Spreading Enemies -------------

    for (let i = 0; i < NO_OF_ENEMIES; i++) {
      getOneSpawnLocationWithinMap().then((loc) => {
        new Enemy(this, loc.x, loc.y, this.player, [
          trees,
          water,
          houses,
          bush,
          stones,
        ])
      })
    }

    // -----------------------------------

    spawnableLocations().then((locations) => {
      locations.forEach((loc) => {
        if (houseEntryPoints.includes([loc.x, loc.y])) return
        // -------- Spreading Collectables --------
        let randVal = Math.random()

        var randItem = COLLECTABLES[(Math.random() * COLLECTABLES.length) | 0]
        const pickupType =
          randItem === "ouchwrap" ||
          randItem === "healbox" ||
          randItem === "boomnut" ||
          randItem === "slowmo-injection"
            ? "bagItem"
            : randItem === "faster-boi"
            ? "faster-boi"
            : randItem === "sliptrap"
            ? "sliptrap"
            : "bagItem"

        // To reduce number of enemies
        if (randVal < COLLECTABLE_SPAWN_CHANCE) {
          AddPhysicsItem(
            this,
            randItem,
            loc.x * 300 * MAP_SCALE_FACTOR + 150 * MAP_SCALE_FACTOR,
            loc.y * 300 * MAP_SCALE_FACTOR + 150 * MAP_SCALE_FACTOR,
            true,
            false,
            true,
            pickupType
          )
        }
      })
    })

    handleCollisions(this, {
      houses,
      water,
      trees,
      bush,
      stones,
    })

    SpreadHouseEntries(this, this.roomManager) // pass it in

    this.playerCountUI.update()

    // Events listening and handling
    this.events.on("enemy-killed", (enemy: Enemy) => {
      this.playerCountUI.update(enemy)
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
    this.roomManager?.update()
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
}
