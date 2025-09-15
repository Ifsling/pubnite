// src/components/Enemy.ts
import * as Phaser from "phaser"
import { ammoAmounts } from "../Constants"
import { spawnableLocations } from "../map/Map"
import GameScene from "../scenes/GameScene"
import Ak47 from "./guns/Ak47"
import Gun, { GUN_RELOAD_TIME } from "./guns/Gun"
import Pistol from "./guns/Pistol"
import Shotgun from "./guns/Shotgun"
import Sniper from "./guns/Sniper"
import Player from "./Player"

// ==== TUNABLE CONSTANTS (top of file) ====
// vision / combat
const FOLLOW_DISTANCE = 2000 // start chasing if target is within this distance (world units)
const SHOOT_DISTANCE = 900 // shoot if within this distance (world units)
const CHASE_SPEED = 140 // movement speed along path (px/s)
const FIRE_COOLDOWN_MS = 300 // min ms between shots for single-fire guns

// pathing
const PATH_RECALC_MS = 250 // how often we recalc a path while moving toward a goal
const WAYPOINT_EPS = 18 // how close to a waypoint to pop it (world px)

// regen
const REGEN_PER_SEC = 6 // HP per second when out of combat
const REGEN_DELAY_MS = 3000 // start regenerating after this long without damage
// =========================================

type Target = Player | Enemy | null

export default class Enemy extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite
  private gun: Gun
  private hasHelmet = false
  private hasVest = false
  private helmetHealth = 0
  private vestHealth = 0
  private maxHealth = 100
  private currentHealth = 10
  private player: Player
  private lastShotTime = 0
  private enemyChosenGun: "pistol" | "ak47" | "shotgun" | "sniper"

  public scene: GameScene
  public shooterType: "player" | "enemy"

  // Health bar
  private healthBarBg: Phaser.GameObjects.Graphics
  private healthBar: Phaser.GameObjects.Graphics
  private healthBarWidth = 40
  private healthBarHeight = 6
  private healthBarOffsetY = -50

  // Pathfinding / movement
  private path: { x: number; y: number }[] = []
  private nextPathRecalcAt = 0
  private goalTile: { x: number; y: number } | null = null
  private wanderGoalTile: { x: number; y: number } | null = null

  // Targeting
  private target: Target = null

  // Regen
  private lastDamageAt = 0

  constructor(
    scene: GameScene,
    x: number,
    y: number,
    player: Player,
    collisionItems?: (Phaser.Tilemaps.TilemapLayer | null)[]
  ) {
    super(scene, x, y)
    this.player = player
    this.scene = scene

    this.sprite = scene.add.sprite(0, 0, "villian")
    this.add(this.sprite)

    // Random equipment
    const equipmentRoll = Phaser.Math.Between(0, 2)
    if (equipmentRoll === 1) this.equipHelmet()
    else if (equipmentRoll === 2) {
      this.equipHelmet()
      this.equipVest()
    }
    this.recalculateMaxHealth()

    // Random gun
    const gunTypes = ["pistol", "ak47", "shotgun", "sniper"] as const
    this.enemyChosenGun = gunTypes[Phaser.Math.Between(0, gunTypes.length - 1)]
    this.gun = this.createGun(this.enemyChosenGun)
    this.add(this.gun)

    scene.physics.world.enable(this)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(true)
    body.setSize(this.sprite.width, this.sprite.height)
    body.setOffset(-this.sprite.width / 2, -this.sprite.height / 2)

    scene.add.existing(this)
    this.shooterType = "enemy"
    GameScene.totalPlayers += 1

    // Health bar
    this.healthBarBg = scene.add.graphics()
    this.healthBar = scene.add.graphics()
    this.drawHealthBar()

    // Collisions with map layers
    if (collisionItems) {
      collisionItems.forEach(
        (layer) => layer && scene.physics.add.collider(this, layer)
      )
    }

    // Register
    scene.enemies.push(this)

    // Pick initial wander goal (async)
    this.pickNewWanderGoal()
  }

  // --- Init helpers
  private createGun(type: string): Gun {
    switch (type) {
      case "pistol":
        return new Pistol(this.scene, 0, 0)
      case "ak47":
        return new Ak47(this.scene, 0, 0)
      case "shotgun":
        return new Shotgun(this.scene, 0, 0)
      case "sniper":
        return new Sniper(this.scene, 0, 0)
      default:
        return new Pistol(this.scene, 0, 0)
    }
  }
  private equipHelmet() {
    this.hasHelmet = true
    this.helmetHealth = 50
  }
  private equipVest() {
    this.hasVest = true
    this.vestHealth = 60
  }
  private recalculateMaxHealth() {
    this.maxHealth =
      100 +
      (this.hasHelmet ? this.helmetHealth : 0) +
      (this.hasVest ? this.vestHealth : 0)
    this.currentHealth = this.maxHealth
  }

  // --- UI
  private drawHealthBar() {
    const hp = Phaser.Math.Clamp(this.currentHealth / this.maxHealth, 0, 1)
    this.healthBarBg.clear()
    this.healthBar.clear()
    this.healthBarBg
      .fillStyle(0x000000, 1)
      .fillRect(
        this.x - this.healthBarWidth / 2,
        this.y + this.healthBarOffsetY,
        this.healthBarWidth,
        this.healthBarHeight
      )
    this.healthBar
      .fillStyle(0xff0000, 1)
      .fillRect(
        this.x - this.healthBarWidth / 2,
        this.y + this.healthBarOffsetY,
        this.healthBarWidth * hp,
        this.healthBarHeight
      )
  }

  private isWalkableTile(tx: number, ty: number) {
    return (this.scene as any).isWalkableTile(tx, ty) as boolean
  }

  private findNearestWalkable(tx: number, ty: number, maxR = 6) {
    if (this.isWalkableTile(tx, ty)) return { x: tx, y: ty }
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue // ring only
          const nx = tx + dx,
            ny = ty + dy
          if (this.isWalkableTile(nx, ny)) return { x: nx, y: ny }
        }
      }
    }
    return null
  }

  // --- Targeting
  private acquireTarget(): Target {
    // Consider player + all *other* enemies
    const candidates: Target[] = [
      this.scene.player,
      ...this.scene.enemies.filter((e) => e !== this),
    ]
    let best: Target = null
    let bestDist = Infinity

    for (const c of candidates) {
      if (!c || (!(c as any).isAlive && c instanceof Player)) continue
      if (c instanceof Enemy && !c.active) continue

      const d = Phaser.Math.Distance.Between(this.x, this.y, c.x, c.y)
      if (d < bestDist) {
        bestDist = d
        best = c
      }
    }

    // Only aggro inside FOLLOW_DISTANCE
    return best &&
      Phaser.Math.Distance.Between(this.x, this.y, best.x, best.y) <=
        FOLLOW_DISTANCE
      ? best
      : null
  }

  // --- Pathing
  private worldToTile(wx: number, wy: number) {
    return (this.scene as any).worldToTile(wx, wy) as { x: number; y: number }
  }
  private tileToWorld(tx: number, ty: number) {
    return (this.scene as any).tileToWorld(tx, ty) as { x: number; y: number }
  }

  private async computePathTo(tileX: number, tileY: number) {
    const sTile = this.worldToTile(this.x, this.y)
    const goal = this.findNearestWalkable(tileX, tileY) // <-- snap target
    if (!goal) {
      this.path = []
      return
    }
    this.goalTile = goal

    const findPathTiles = (this.scene as any).findPathTiles as (
      sx: number,
      sy: number,
      ex: number,
      ey: number
    ) => Promise<{ x: number; y: number }[]>

    this.path = await findPathTiles(sTile.x, sTile.y, goal.x, goal.y)
  }

  private followPath(delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (!this.path || this.path.length < 2) {
      body.setVelocity(0)
      return
    }

    // Next waypoint (skip index 0 = current tile)
    const wp = this.path[1]
    const wpWorld = this.tileToWorld(wp.x, wp.y)
    const dx = wpWorld.x - this.x
    const dy = wpWorld.y - this.y
    const dist = Math.hypot(dx, dy)

    if (dist < WAYPOINT_EPS) {
      // Pop reached waypoint
      this.path.shift()
      return
    }

    // Move toward waypoint
    const ang = Math.atan2(dy, dx)
    body.setVelocity(Math.cos(ang) * CHASE_SPEED, Math.sin(ang) * CHASE_SPEED)
  }

  private async ensurePathToWorld(wx: number, wy: number, now: number) {
    const g = this.worldToTile(wx, wy)
    if (
      !this.goalTile ||
      this.goalTile.x !== g.x ||
      this.goalTile.y !== g.y ||
      now >= this.nextPathRecalcAt
    ) {
      this.nextPathRecalcAt = now + PATH_RECALC_MS
      await this.computePathTo(g.x, g.y)
    }
  }

  private async pickNewWanderGoal() {
    const locs = await spawnableLocations()
    if (!locs.length) {
      this.wanderGoalTile = null
      return
    }
    const idx = (Math.random() * locs.length) | 0
    this.wanderGoalTile = { x: locs[idx].x, y: locs[idx].y }
    this.goalTile = null
    this.path = []
  }

  // --- Update
  public update(time: number, delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body

    // 1) Acquire/refresh target
    const newTarget = this.acquireTarget()
    if (newTarget !== this.target) {
      // stop ak47 when switching targets / losing target
      if (this.enemyChosenGun === "ak47") (this.gun as Ak47).stopFiring?.()
      this.target = newTarget
      this.goalTile = null // force re-path to new goal
      this.path = []
    }

    // 2) Decide goal: target (aggro) vs wander
    let goalWorld: { x: number; y: number } | null = null
    if (this.target) {
      goalWorld = { x: this.target.x, y: this.target.y }
    } else {
      // no target → wander
      if (!this.wanderGoalTile) {
        // pick if none yet
        this.pickNewWanderGoal()
      } else {
        goalWorld = this.tileToWorld(
          this.wanderGoalTile.x,
          this.wanderGoalTile.y
        )
        // If at wander goal, pick a new one
        if (
          goalWorld &&
          Phaser.Math.Distance.Between(
            this.x,
            this.y,
            goalWorld.x,
            goalWorld.y
          ) <
            WAYPOINT_EPS * 2
        ) {
          this.pickNewWanderGoal()
          goalWorld = null
        }
      }
    }

    // 3) Movement toward goal (walk only on walkable via path)
    if (goalWorld) {
      this.ensurePathToWorld(goalWorld.x, goalWorld.y, time)
      this.followPath(delta)
    } else {
      body.setVelocity(0)
    }

    // 4) Shooting logic (works for Player or Enemy)
    if (this.target) {
      const dist = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        this.target.x,
        this.target.y
      )
      const inShootRange = dist <= SHOOT_DISTANCE

      if (!inShootRange && this.enemyChosenGun === "ak47") {
        ;(this.gun as Ak47).stopFiring?.()
      }

      if (inShootRange && time > this.lastShotTime + FIRE_COOLDOWN_MS) {
        if (this.gun.ammo <= 0) this.reload(this.enemyChosenGun)

        if (this.enemyChosenGun === "ak47") {
          ;(this.gun as Ak47).startFiring()
        }

        const tx = this.target.x
        const ty = this.target.y
        this.gun.tryShoot(this, {
          worldX: tx,
          worldY: ty,
        } as Phaser.Input.Pointer)
        this.lastShotTime = time
      }
    }

    // 5) Orient gun
    const lookX = this.target ? this.target.x : this.x + (body.velocity.x || 1)
    const lookY = this.target ? this.target.y : this.y + (body.velocity.y || 0)
    this.gun.x = 0
    this.gun.y = 0
    this.gun.rotation = Phaser.Math.Angle.Between(this.x, this.y, lookX, lookY)
    this.gun.update()

    // 6) Regen
    const since = time - this.lastDamageAt
    if (
      since > REGEN_DELAY_MS &&
      this.currentHealth > 0 &&
      this.currentHealth < this.maxHealth
    ) {
      const add = REGEN_PER_SEC * (delta / 1000)
      this.currentHealth = Math.min(this.maxHealth, this.currentHealth + add)
    }

    // 7) Health bar
    this.drawHealthBar()
  }

  // --- Shooting helpers
  private reload(gunType: string | null) {
    let reloadTime
    switch (gunType) {
      case "pistol":
        reloadTime = GUN_RELOAD_TIME.pistol
        break
      case "ak47":
        reloadTime = GUN_RELOAD_TIME.ak47
        break
      case "shotgun":
        reloadTime = GUN_RELOAD_TIME.shotgun
        break
      case "sniper":
        reloadTime = GUN_RELOAD_TIME.sniper
        break
      default:
        reloadTime = GUN_RELOAD_TIME.shotgun
    }
    this.scene.time.delayedCall(reloadTime, () => {
      const ammoToAdd = ammoAmounts[gunType || "pistol"] || 10
      this.gun.addAmmo(ammoToAdd)
    })
  }

  // --- Damage / death
  public takeDamage(amount: number) {
    // mark combat time (delays regen)
    this.lastDamageAt = this.scene.time.now

    if (
      this.hasHelmet &&
      this.currentHealth <= this.maxHealth - this.helmetHealth
    ) {
      this.hasHelmet = false
      this.helmetHealth = 0
    }
    if (this.hasVest && this.currentHealth <= 100) {
      this.hasVest = false
      this.vestHealth = 0
    }

    this.currentHealth -= amount
    if (this.currentHealth <= 0) {
      // notify counts, stop firing, cleanup
      if (this.enemyChosenGun === "ak47") (this.gun as Ak47).stopFiring?.()
      this.scene.events.emit("enemy-killed", this)
      this.scene.enemies = this.scene.enemies.filter((e) => e !== this)
      this.healthBar.destroy()
      this.healthBarBg.destroy()
      this.destroy()
    } else {
      this.drawHealthBar()
    }
  }

  public getHealth() {
    return this.currentHealth
  }

  public handleBulletHitEnemy(
    obj1:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile,
    obj2:
      | Phaser.Types.Physics.Arcade.GameObjectWithBody
      | Phaser.Physics.Arcade.Body
      | Phaser.Physics.Arcade.StaticBody
      | Phaser.Tilemaps.Tile
  ): void {
    const bullet = obj2 as Phaser.Physics.Arcade.Sprite
    const enemy = obj1 as Enemy
    const damage = (bullet as any).damage || 10
    enemy.takeDamage(damage)
    bullet.destroy()
  }
}
