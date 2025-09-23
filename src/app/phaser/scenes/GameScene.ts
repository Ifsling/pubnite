// src/scenes/GameScene.ts
import { getOneSpawnLocationWithinMap } from "@/src/app/utils"
import EasyStar from "easystarjs"
import * as Phaser from "phaser"
import { SetupEasyStar } from "../components/easystar/EasyStarSetup"
import Enemy from "../components/Enemy"
import Player from "../components/Player"
import RoomManager from "../components/RoomManager"
import SpreadHouseEntries from "../components/SpreadHouseEntries"
import BagUI from "../components/ui/BagUi"
import BulletCountUI from "../components/ui/BulletCountUi"
import DeathOverlay from "../components/ui/DeathOverlay"
import GunAndHealthUi from "../components/ui/GunAndHealthUi"
import PlayerCountUI from "../components/ui/PlayerCountUi"
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
  easystar!: EasyStar.js
  mapGrid!: number[][]
  map!: Phaser.Tilemaps.Tilemap
  player!: Player
  bagUI!: BagUI
  // healthUI!: HealthUI
  // gunUI!: GunUI
  healthAndGunUI!: GunAndHealthUi
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

  totalPlayers: number = 0
  public spawnableLocations: { x: number; y: number }[] = [] // ✨ Added property

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
    this.mapGrid = SetupEasyStar(this)

    const location = getOneSpawnLocationWithinMap()

    this.player = new Player(this, 1500, 3400)
    this.bagUI = new BagUI(this, this.player)
    // this.healthUI = new HealthUI(this, this.player)
    // this.gunUI = new GunUI(this, this.player)
    this.bulletCountUI = new BulletCountUI(this)
    this.playerBullets = this.physics.add.group()
    this.enemyBullets = this.physics.add.group()
    this.playerCountUI = new PlayerCountUI(this)
    this.roomManager = new RoomManager(this)
    this.healthAndGunUI = new GunAndHealthUi(this, this.player)

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
        this.playerCountUI.update()
      })
    }

    // -----------------------------------

    spawnableLocations().then((locations) => {
      this.spawnableLocations = locations // ✨ Storing locations for enemies to use
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
      this.playerCountUI.update() // ✨ Update UI

      // ✨ Check for win condition
      const aliveEnemies = this.enemies.filter((e) => e.active).length
      if (this.player.isAlive && aliveEnemies === 0) {
        new DeathOverlay(this, this.enemies, true, this.totalPlayers)
      }
    })

    this.events.on("player-dead", () => {
      this.playerCountUI.update() // ✨ Update UI on player death
      new DeathOverlay(this, this.enemies, false, this.totalPlayers)
    })

    this.cameras.main.startFollow(this.player)
  }

  update(time: number, delta: number) {
    this.player.update()
    this.bagUI.update()
    // this.healthUI.update()
    // this.gunUI.update()
    this.roomManager?.update()
    this.bulletCountUI.update(this.player.getActiveGun())
    this.healthAndGunUI.update()

    this.enemies.forEach((enemy) => {
      if (enemy.active) {
        enemy.update(time, delta)
      }
    })

    // Handle G key for pickup
    if (this.input.keyboard!.checkDown(this.input.keyboard!.addKey("G"), 250)) {
      this.player.tryPickup()
    }

    // TEMP --- DELETE THIS LATER ----
    if (this.input.keyboard!.checkDown(this.input.keyboard!.addKey("P"), 250)) {
      console.log("PRESSED P")
      this.enemies.forEach((enemy) => {
        if (enemy.active) {
          console.log("Position: ", enemy.x, enemy.y)
        }
      })
    }
  }
}
