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

// ====== DROP / FLIGHT TUNABLES ======
const PLANE_SPEED_PX_PER_SEC = 280 // ✨ slower plane (was ~800 in your code)
const ENEMY_JUMP_DELAY_MIN_MS = 2500 // ✨ enemies wait at least this long before jumping
const ENEMY_JUMP_DELAY_MAX_MS = 9000 // ✨ and at most this long (also capped by flight time)

const PARACHUTE_SPEED_PLAYER_PX_PER_SEC = 140 // ✨ slower player descent
const PARACHUTE_SPEED_ENEMY_PX_PER_SEC = 140 // ✨ slower enemy descent (same as player)

const PLAYER_FALL_MIN_MS = 4000 // optional floor on fall time
const PLAYER_FALL_MAX_MS = 14000 // optional cap on fall time

const ENEMY_FALL_MIN_MS = 3500 // optional floor on enemy fall time
const ENEMY_FALL_MAX_MS = 14000 // optional cap on enemy fall time

const AUTO_DROP_EDGE_MARGIN = 50 // clamp auto-drop inside map by this margin
// =====================================

export default class GameScene extends Phaser.Scene {
  easystar!: EasyStar.js
  mapGrid!: number[][]
  map!: Phaser.Tilemaps.Tilemap
  player!: Player
  bagUI!: BagUI
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
  public spawnableLocations: { x: number; y: number }[] = []

  // ✨ Plane-drop state
  public inDropPhase: boolean = true
  private plane!: Phaser.GameObjects.GameObject // simple rectangle “plane”
  private dropMarker: Phaser.GameObjects.GameObject | null = null
  private playerParachuter: Phaser.GameObjects.Container | null = null
  private dropTarget: Phaser.Math.Vector2 | null = null
  private enemyParachuters: Map<Enemy, Phaser.GameObjects.Container> = new Map()

  constructor() {
    super("MyScene")
  }

  preload() {
    PreloadAssets(this)
  }

  async create() {
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

    // ✨ Create player but keep hidden & disabled until landing
    this.player = new Player(this, 0, 0)
    this.player.setVisible(false)
    ;(this.player.body as Phaser.Physics.Arcade.Body).enable = false

    this.bagUI = new BagUI(this, this.player)
    this.bulletCountUI = new BulletCountUI(this)
    this.playerBullets = this.physics.add.group()
    this.enemyBullets = this.physics.add.group()
    this.playerCountUI = new PlayerCountUI(this)
    this.roomManager = new RoomManager(this)
    this.healthAndGunUI = new GunAndHealthUi(this, this.player)

    // ---------- Spreading Enemies (they’ll start hidden/disabled; see Enemy.ts) -------------
    // for (let i = 0; i < NO_OF_ENEMIES; i++) {
    //   getOneSpawnLocationWithinMap().then((loc) => {
    //     new Enemy(this, loc.x, loc.y, this.player, [
    //       trees,
    //       water,
    //       houses,
    //       bush,
    //       stones,
    //     ])
    //     this.playerCountUI.update()
    //   })
    // }
    // -----------------------------------

    spawnableLocations().then((locations) => {
      this.spawnableLocations = locations
      locations.forEach((loc) => {
        if (houseEntryPoints.includes([loc.x, loc.y])) return
        let randVal = Math.random()

        const randItem = COLLECTABLES[(Math.random() * COLLECTABLES.length) | 0]
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

    SpreadHouseEntries(this, this.roomManager)

    this.playerCountUI.update()

    // Events listening and handling
    this.events.on("enemy-killed", (enemy: Enemy) => {
      this.playerCountUI.update()
      const aliveEnemies = this.enemies.filter((e) => e.active).length
      if (this.player.isAlive && aliveEnemies === 0) {
        new DeathOverlay(this, this.enemies, true, this.totalPlayers)
      }
    })

    this.events.on("player-dead", () => {
      this.playerCountUI.update()
      new DeathOverlay(this, this.enemies, false, this.totalPlayers)
    })

    await this.spawnEnemiesAndWait(trees, water, houses, bush, stones)

    // ✨ Start plane-drop phase
    this.startDropPhase()
  }

  update(time: number, delta: number) {
    // Player/enemy update runs as normal, but they’re invisible/disabled during drop.
    this.player.update()
    this.bagUI.update()
    this.roomManager?.update()
    this.bulletCountUI.update(this.player.getActiveGun())
    this.healthAndGunUI.update()

    this.enemies.forEach((enemy) => {
      if (enemy.active) {
        enemy.update(time, delta)
      }
    })

    if (this.input.keyboard!.checkDown(this.input.keyboard!.addKey("G"), 250)) {
      this.player.tryPickup()
    }

    if (this.input.keyboard!.checkDown(this.input.keyboard!.addKey("P"), 250)) {
      console.log("PRESSED P")
      this.enemies.forEach((enemy) => {
        if (enemy.active) {
          console.log("Position: ", enemy.x, enemy.y)
        }
      })
    }
  }

  // ===== ✨ Plane-drop helpers =====

  private randEdgePoint(w: number, h: number): Phaser.Math.Vector2 {
    const edge = Phaser.Math.Between(0, 3)
    switch (edge) {
      case 0:
        return new Phaser.Math.Vector2(Phaser.Math.Between(-200, w + 200), -200) // top
      case 1:
        return new Phaser.Math.Vector2(
          w + 200,
          Phaser.Math.Between(-200, h + 200)
        ) // right
      case 2:
        return new Phaser.Math.Vector2(
          Phaser.Math.Between(-200, w + 200),
          h + 200
        ) // bottom
      default:
        return new Phaser.Math.Vector2(-200, Phaser.Math.Between(-200, h + 200)) // left
    }
  }

  private planeDuration(start: Phaser.Math.Vector2, end: Phaser.Math.Vector2) {
    const dist = Phaser.Math.Distance.BetweenPoints(start, end)
    return (dist / PLANE_SPEED_PX_PER_SEC) * 1000
  }

  private startDropPhase() {
    this.inDropPhase = true
    this.dropTarget = null
    this.dropMarker?.destroy()
    this.dropMarker = null
    this.playerParachuter?.destroy()
    this.playerParachuter = null

    // Zoom out to view most of the map
    const fitZoom =
      Math.min(
        this.scale.width / this.map.widthInPixels,
        this.scale.height / this.map.heightInPixels
      ) * 0.95
    this.cameras.main.stopFollow()
    this.cameras.main.setZoom(fitZoom)
    this.cameras.main.centerOn(
      this.map.widthInPixels / 2,
      this.map.heightInPixels / 2
    )

    // Random plane path across the map
    const start = this.randEdgePoint(
      this.map.widthInPixels,
      this.map.heightInPixels
    )
    let end = this.randEdgePoint(
      this.map.widthInPixels,
      this.map.heightInPixels
    )
    for (
      let i = 0;
      i < 6 &&
      Phaser.Math.Distance.BetweenPoints(start, end) <
        Math.min(this.map.widthInPixels, this.map.heightInPixels) * 0.6;
      i++
    ) {
      end = this.randEdgePoint(this.map.widthInPixels, this.map.heightInPixels)
    }

    // “Plane” – simple rectangle so no asset required
    this.plane?.destroy()
    this.plane = this.add
      .sprite(start.x, start.y, "airplane")
      .setScale(0.5)
      .setDepth(10000)
    const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y)
    ;(this.plane as Phaser.GameObjects.Sprite).setRotation(angle)

    const duration = this.planeDuration(start, end)
    this.tweens.add({
      targets: this.plane,
      x: end.x,
      y: end.y,
      duration,
      ease: "Linear",
      onComplete: () => {
        if (this.inDropPhase && !this.dropTarget) {
          // Clamp plane’s end inside map
          let tx = Phaser.Math.Clamp(
            end.x,
            AUTO_DROP_EDGE_MARGIN,
            this.map.widthInPixels - AUTO_DROP_EDGE_MARGIN
          )
          let ty = Phaser.Math.Clamp(
            end.y,
            AUTO_DROP_EDGE_MARGIN,
            this.map.heightInPixels - AUTO_DROP_EDGE_MARGIN
          )

          // Try to adjust to a walkable tile if helpers exist
          const isWalkable = (this as any).isWalkableTile as
            | ((tx: number, ty: number) => boolean)
            | undefined
          const worldToTile = (this as any).worldToTile as
            | ((wx: number, wy: number) => { x: number; y: number })
            | undefined
          const tileToWorld = (this as any).tileToWorld as
            | ((tx: number, ty: number) => { x: number; y: number })
            | undefined

          if (isWalkable && worldToTile && tileToWorld) {
            const g = worldToTile(tx, ty)
            if (!isWalkable(g.x, g.y)) {
              // fall back to a random ground point if end isn’t walkable
              const p = this.getRandomGroundPoint()
              tx = p.x
              ty = p.y
            } else {
              const c = tileToWorld(g.x, g.y)
              tx = c.x
              ty = c.y
            }
          }

          this.handlePlayerJump(tx, ty)
        }
      },
    })

    // Enemies drop automatically across the map
    this.scheduleEnemyDropsAcrossMap(start, end, duration)

    // Player clicks to choose drop point
    this.input.once("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const worldPt = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
      this.handlePlayerJump(worldPt.x, worldPt.y)
    })
  }

  /** Enemies jump from the plane but land at random spots anywhere on the map. */
  private scheduleEnemyDropsAcrossMap(
    start: Phaser.Math.Vector2,
    end: Phaser.Math.Vector2,
    flightMs: number
  ) {
    if (!this.enemies.length) return

    const makePara = (x: number, y: number, scale = 0.6) => {
      const canopy = this.add.ellipse(0, -22, 30, 18, 0xffffff, 0.9)
      const ropeL = this.add.line(0, 0, -8, -14, -2, 0, 0xffffff, 0.85)
      const ropeR = this.add.line(0, 0, 8, -14, 2, 0, 0xffffff, 0.85)
      const doll = this.add.rectangle(0, 0, 12, 18, 0x333333, 1)
      return this.add
        .container(x, y, [canopy, ropeL, ropeR, doll])
        .setDepth(8500)
        .setScale(scale)
    }

    // Stagger within flight time, but also respect your min/max
    const maxUsableDelay = Math.max(1000, flightMs - 1000)

    this.enemies.forEach((enemy) => {
      const dropAtMs = Phaser.Math.Clamp(
        Phaser.Math.Between(ENEMY_JUMP_DELAY_MIN_MS, ENEMY_JUMP_DELAY_MAX_MS),
        500,
        maxUsableDelay
      )

      // Choose a random valid landing spot anywhere on the map
      const target = this.getRandomGroundPoint()

      this.time.delayedCall(dropAtMs, () => {
        const px = (this.plane as any).x
        const py = (this.plane as any).y

        const para = makePara(px, py)
        this.enemyParachuters.set(enemy, para)

        // Descent time proportional to distance (farther ⇒ longer)
        const dist = Phaser.Math.Distance.Between(px, py, target.x, target.y)
        const fallMs = Phaser.Math.Clamp(
          (dist / PARACHUTE_SPEED_ENEMY_PX_PER_SEC) * 1000,
          ENEMY_FALL_MIN_MS,
          ENEMY_FALL_MAX_MS
        )

        this.tweens.add({
          targets: para,
          x: target.x,
          y: target.y,
          duration: fallMs,
          ease: "Sine.Out",
          onComplete: () => {
            if (!enemy || !enemy.scene || !enemy.active) {
              para.destroy()
              this.enemyParachuters.delete(enemy)
              return
            }
            const body = enemy.body as Phaser.Physics.Arcade.Body | undefined
            if (!body) {
              para.destroy()
              this.enemyParachuters.delete(enemy)
              return
            }

            enemy.setPosition(target.x, target.y)
            enemy.setVisible(true)
            body.enable = true
            ;(enemy as any).landed = true
            para.destroy()
            this.enemyParachuters.delete(enemy)
          },
        })
      })
    })
  }

  private handlePlayerJump(rawX: number, rawY: number) {
    if (!this.inDropPhase) return

    // Optional clamp to walkable tile center if your helpers exist
    let tx = rawX,
      ty = rawY
    const isWalkable = (this as any).isWalkableTile as
      | ((tx: number, ty: number) => boolean)
      | undefined
    const worldToTile = (this as any).worldToTile as
      | ((wx: number, wy: number) => { x: number; y: number })
      | undefined
    const tileToWorld = (this as any).tileToWorld as
      | ((tx: number, ty: number) => { x: number; y: number })
      | undefined
    if (isWalkable && worldToTile && tileToWorld) {
      const g = worldToTile(rawX, rawY)
      if (isWalkable(g.x, g.y)) {
        const c = tileToWorld(g.x, g.y)
        tx = c.x
        ty = c.y
      }
    }

    this.dropTarget = new Phaser.Math.Vector2(tx, ty)

    // Visual target marker (optional)
    this.dropMarker?.destroy()
    this.dropMarker = this.add
      .sprite(tx, ty, "drop_x")
      .setOrigin(0.5)
      .setScale(0.5) // tweak as needed
      .setDepth(9999)

    // Create a simple parachuter container at plane position
    const canopy = this.add.ellipse(0, -28, 36, 22, 0xffffff, 0.85)
    const ropeL = this.add.line(0, 0, -10, -18, -2, 0, 0xffffff, 0.8)
    const ropeR = this.add.line(0, 0, 10, -18, 2, 0, 0xffffff, 0.8)
    const doll = this.add.sprite(0, 0, "player").setScale(0.6)
    this.playerParachuter = this.add
      .container((this.plane as any).x, (this.plane as any).y, [
        canopy,
        ropeL,
        ropeR,
        doll,
      ])
      .setDepth(9000)

    // Smoothly zoom back to gameplay zoom
    const sx = (this.plane as any).x
    const sy = (this.plane as any).y
    const dist = Phaser.Math.Distance.Between(sx, sy, tx, ty)
    const fallMs = Phaser.Math.Clamp(
      (dist / PARACHUTE_SPEED_PLAYER_PX_PER_SEC) * 1000,
      PLAYER_FALL_MIN_MS,
      PLAYER_FALL_MAX_MS
    )

    this.tweens.add({
      targets: this.playerParachuter,
      x: tx,
      y: ty,
      duration: fallMs,
      ease: "Sine.Out",
      onUpdate: () =>
        this.cameras.main.centerOn(
          this.playerParachuter!.x,
          this.playerParachuter!.y
        ),
      onComplete: () => this.finishPlayerDrop(),
    })
  }

  private finishPlayerDrop() {
    if (!this.dropTarget) return

    // Enable the real player
    this.player.setPosition(this.dropTarget.x, this.dropTarget.y)
    this.player.setVisible(true)
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.enable = true

    // Camera follow
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15)
    this.cameras.main.setZoom(1.0)

    // Cleanup visuals
    this.playerParachuter?.destroy()
    this.playerParachuter = null
    this.dropMarker?.destroy()
    this.dropMarker = null
    this.dropTarget = null
    this.plane?.destroy()

    // Drop phase ends → normal game starts
    this.inDropPhase = false
  }

  private async spawnEnemiesAndWait(
    trees: Phaser.Tilemaps.TilemapLayer | null,
    water: Phaser.Tilemaps.TilemapLayer | null,
    houses: Phaser.Tilemaps.TilemapLayer | null,
    bush: Phaser.Tilemaps.TilemapLayer | null,
    stones: Phaser.Tilemaps.TilemapLayer | null
  ) {
    // prefetch NO_OF_ENEMIES spawn locations
    const spawns = await Promise.all(
      Array.from({ length: NO_OF_ENEMIES }, () =>
        getOneSpawnLocationWithinMap()
      )
    )

    spawns.forEach((loc) => {
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

  /** Pick a random walkable world position anywhere on the map. */
  private getRandomGroundPoint(): Phaser.Math.Vector2 {
    const W = this.map.widthInPixels
    const H = this.map.heightInPixels

    // Optional hooks (if you wired them for pathfinding)
    const isWalkable = (this as any).isWalkableTile as
      | ((tx: number, ty: number) => boolean)
      | undefined
    const worldToTile = (this as any).worldToTile as
      | ((wx: number, wy: number) => { x: number; y: number })
      | undefined
    const tileToWorld = (this as any).tileToWorld as
      | ((tx: number, ty: number) => { x: number; y: number })
      | undefined

    // Try a bunch of random samples until we find a walkable tile (if hooks exist)
    for (let i = 0; i < 60; i++) {
      const rx = Phaser.Math.Between(30, W - 30)
      const ry = Phaser.Math.Between(30, H - 30)

      if (isWalkable && worldToTile && tileToWorld) {
        const g = worldToTile(rx, ry)
        if (isWalkable(g.x, g.y)) {
          const c = tileToWorld(g.x, g.y)
          return new Phaser.Math.Vector2(c.x, c.y)
        }
      } else {
        // No walkability hooks — just return the random point
        return new Phaser.Math.Vector2(rx, ry)
      }
    }

    // Fallback: center of map
    return new Phaser.Math.Vector2(W * 0.5, H * 0.5)
  }
}
