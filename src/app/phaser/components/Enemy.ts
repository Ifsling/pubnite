// src/components/Enemy.ts
import * as Phaser from "phaser"
import { ammoAmounts, houseEntryPoints } from "../Constants"
import GameScene from "../scenes/GameScene"
import Player from "./Player"
import Ak47 from "./guns/Ak47"
import Gun, { GUN_RELOAD_TIME } from "./guns/Gun"
import Pistol from "./guns/Pistol"
import Shotgun from "./guns/Shotgun"
import Sniper from "./guns/Sniper"

// ==== Tunables ====
// Movement / pathing
const CHASE_SPEED = 300
const PATH_RECALC_MS = 250
const WAYPOINT_EPS = 18

// Combat
const FOLLOW_DISTANCE = 2000
const SHOOT_DISTANCE = 900
const FIRE_COOLDOWN_MS = 300
const STANDOFF_DIST = 300
const STANDOFF_HYST = 40

// Looting
const LOOT_WAIT_MIN_MS = 5000
const LOOT_WAIT_MAX_MS = 10000

// Soft separation
const SEPARATION_RADIUS = 120
const SEPARATION_FORCE = 200

enum Phase {
  GoingToEntry,
  Looting,
  Hunting,
  Dead,
}

type Target = Player | Enemy | null
type GunKey = "pistol" | "ak47" | "shotgun" | "sniper"

export default class Enemy extends Phaser.GameObjects.Container {
  public scene: GameScene
  public shooterType: "player" | "enemy" = "enemy"

  // visuals
  private sprite: Phaser.GameObjects.Sprite
  private healthBarBg: Phaser.GameObjects.Graphics
  private healthBar: Phaser.GameObjects.Graphics
  private readonly healthBarWidth = 40
  private readonly healthBarHeight = 6
  private readonly healthBarOffsetY = -50

  // gear / combat
  private gun: Gun | null = null
  private enemyGunType: GunKey | null = null
  private lastShotTime = 0

  // durability
  private hasHelmet = false
  private hasVest = false
  private helmetHealth = 0
  private vestHealth = 0
  private maxHealth = 100
  private currentHealth = 100

  // behavior
  private phase: Phase = Phase.GoingToEntry
  private entryTarget: Phaser.Math.Vector2 | null = null
  private lootStartedAt = 0
  private lootWaitDuration = 0

  // movement/pathing
  private path: { x: number; y: number }[] = []
  private nextPathRecalcAt = 0
  private goalTile: { x: number; y: number } | null = null

  // targeting
  private target: Target = null
  private explicitTarget: Phaser.GameObjects.GameObject | null = null

  constructor(
    scene: GameScene,
    x: number,
    y: number,
    _player: Player, // kept for compatibility
    collisionItems?: (Phaser.Tilemaps.TilemapLayer | null)[]
  ) {
    super(scene, x, y)
    this.scene = scene

    // visuals
    this.sprite = scene.add.sprite(0, 0, "villian")
    this.add(this.sprite)

    // physics on the container; size to sprite
    scene.physics.world.enable(this)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(true)
    body.setSize(this.sprite.width, this.sprite.height)
    body.setOffset(-this.sprite.width / 2, -this.sprite.height / 2)

    // add to scene & registry
    scene.add.existing(this)
    scene.enemies.push(this)

    // health bar
    this.healthBarBg = scene.add.graphics()
    this.healthBar = scene.add.graphics()
    this.drawHealthBar()

    // map collisions (if provided)
    if (collisionItems) {
      collisionItems.forEach((layer) => {
        if (layer) scene.physics.add.collider(this, layer)
      })
    }

    // choose nearest entry (world coords)
    this.entryTarget = this.findNearestEntry()
  }

  // ==== Helpers ====

  public setExplicitTarget(t: Phaser.GameObjects.GameObject | null) {
    this.explicitTarget = t
  }

  private createGun(type: GunKey): Gun {
    switch (type) {
      case "ak47":
        return new Ak47(this.scene, 0, 0)
      case "shotgun":
        return new Shotgun(this.scene, 0, 0)
      case "sniper":
        return new Sniper(this.scene, 0, 0)
      case "pistol":
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
  private recalcMaxHealth() {
    this.maxHealth =
      100 +
      (this.hasHelmet ? this.helmetHealth : 0) +
      (this.hasVest ? this.vestHealth : 0)
    this.currentHealth = Math.min(this.currentHealth, this.maxHealth)
  }

  private findNearestEntry(): Phaser.Math.Vector2 | null {
    if (!houseEntryPoints || houseEntryPoints.length === 0) return null

    // Convert from tile coords -> world coords if needed
    const toWorld = (p: any) => {
      const tx = p[0] ?? p.x
      const ty = p[1] ?? p.y
      if (this.tileToWorld) {
        const { x, y } = this.tileToWorld(tx, ty)
        return new Phaser.Math.Vector2(x, y)
      } else {
        // fallback: assume already world coords
        return new Phaser.Math.Vector2(tx, ty)
      }
    }

    let best = toWorld(houseEntryPoints[0])
    let bestD = Phaser.Math.Distance.Between(this.x, this.y, best.x, best.y)

    for (const p of houseEntryPoints as any[]) {
      const wp = toWorld(p)
      const d = Phaser.Math.Distance.Between(this.x, this.y, wp.x, wp.y)
      if (d < bestD) {
        best = wp
        bestD = d
      }
    }

    return best
  }

  // ---- Pathfinding hooks detection ----
  private get worldToTile() {
    return (this.scene as any).worldToTile as
      | ((wx: number, wy: number) => { x: number; y: number })
      | undefined
  }
  private get tileToWorld() {
    return (this.scene as any).tileToWorld as
      | ((tx: number, ty: number) => { x: number; y: number })
      | undefined
  }
  private get findPathTiles() {
    return (this.scene as any).findPathTiles as
      | ((
          sx: number,
          sy: number,
          ex: number,
          ey: number
        ) => Promise<{ x: number; y: number }[]>)
      | undefined
  }
  private hasPathfinding() {
    return !!(this.worldToTile && this.tileToWorld && this.findPathTiles)
  }

  // ---- Pathing (with fallback) ----
  private async computePathToWorld(wx: number, wy: number) {
    if (!this.hasPathfinding()) {
      this.path = [] // force direct steering
      return
    }
    const s = this.worldToTile!(this.x, this.y)
    const g = this.worldToTile!(wx, wy)
    this.path = await this.findPathTiles!(s.x, s.y, g.x, g.y)
    this.goalTile = { x: g.x, y: g.y }
  }

  private followPathOrSteerTo(wx: number, wy: number) {
    const body = this.body as Phaser.Physics.Arcade.Body

    if (this.hasPathfinding() && this.path && this.path.length >= 2) {
      const wp = this.path[1]
      const wpWorld = this.tileToWorld!(wp.x, wp.y)
      const dx = wpWorld.x - this.x
      const dy = wpWorld.y - this.y
      const dist = Math.hypot(dx, dy)
      if (dist < WAYPOINT_EPS) {
        this.path.shift()
        return
      }
      const ang = Math.atan2(dy, dx)
      body.setVelocity(Math.cos(ang) * CHASE_SPEED, Math.sin(ang) * CHASE_SPEED)
      return
    }

    // Fallback: steer straight to the goal
    const dx = wx - this.x
    const dy = wy - this.y
    const dist = Math.hypot(dx, dy)
    if (dist > 1) {
      const ang = Math.atan2(dy, dx)
      body.setVelocity(Math.cos(ang) * CHASE_SPEED, Math.sin(ang) * CHASE_SPEED)
    } else {
      body.setVelocity(0, 0)
    }
  }

  private async ensurePathToWorld(wx: number, wy: number, now: number) {
    if (!this.hasPathfinding()) return // direct steering mode
    const goal = this.worldToTile!(wx, wy)
    if (
      !this.goalTile ||
      this.goalTile.x !== goal.x ||
      this.goalTile.y !== goal.y ||
      now >= this.nextPathRecalcAt
    ) {
      this.nextPathRecalcAt = now + PATH_RECALC_MS
      await this.computePathToWorld(wx, wy)
    }
  }

  private standoffPointFromTarget(tx: number, ty: number) {
    const dx = this.x - tx
    const dy = this.y - ty
    const len = Math.hypot(dx, dy) || 1
    const nx = dx / len
    const ny = dy / len
    return { x: tx + nx * STANDOFF_DIST, y: ty + ny * STANDOFF_DIST }
  }

  private applySeparation() {
    const body = this.body as Phaser.Physics.Arcade.Body
    let rx = 0,
      ry = 0,
      cnt = 0
    for (const e of this.scene.enemies) {
      if (e === this || !e.active) continue
      const dx = this.x - e.x
      const dy = this.y - e.y
      const d = Math.hypot(dx, dy)
      if (d > 0 && d < SEPARATION_RADIUS) {
        const strength = (SEPARATION_RADIUS - d) / SEPARATION_RADIUS
        rx += (dx / d) * strength
        ry += (dy / d) * strength
        cnt++
      }
    }
    if (cnt > 0) {
      const len = Math.hypot(rx, ry)
      if (len > 0) {
        rx = (rx / len) * SEPARATION_FORCE
        ry = (ry / len) * SEPARATION_FORCE
        body.setVelocity(body.velocity.x + rx, body.velocity.y + ry)
      }
    }
  }

  private acquireTarget(): Target {
    if (this.explicitTarget && (this.explicitTarget as any).active !== false) {
      const d = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        (this.explicitTarget as any).x,
        (this.explicitTarget as any).y
      )
      if (d <= FOLLOW_DISTANCE) return this.explicitTarget as any
    }
    const candidates: (Player | Enemy)[] = [
      this.scene.player,
      ...this.scene.enemies.filter((e) => e !== this),
    ]
    let best: Player | Enemy | null = null
    let bestDist = Infinity
    for (const c of candidates) {
      if (!c || (c instanceof Player && !c.isAlive)) continue
      const d = Phaser.Math.Distance.Between(this.x, this.y, c.x, c.y)
      if (d < bestDist) {
        best = c
        bestDist = d
      }
    }
    return bestDist <= FOLLOW_DISTANCE ? best : null
  }

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

  // ==== Loot/equip ====
  private equipRandomGear() {
    const gunChoices = ["pistol", "ak47", "shotgun", "sniper"] as const
    const idx = Phaser.Math.Between(0, gunChoices.length - 1)
    const chosen: GunKey = gunChoices[idx]
    this.enemyGunType = chosen

    this.gun = this.createGun(chosen)
    this.add(this.gun)

    const ammoToAdd = ammoAmounts[chosen] ?? 15
    this.gun.addAmmo(ammoToAdd)

    const roll = Phaser.Math.Between(0, 2) // 0 none, 1 helmet, 2 both
    if (roll === 1) this.equipHelmet()
    else if (roll === 2) {
      this.equipHelmet()
      this.equipVest()
    }
    this.recalcMaxHealth()
  }

  // ==== Main update ====
  public async update(time: number, _delta: number) {
    if (this.phase === Phase.Dead) return

    const body = this.body as Phaser.Physics.Arcade.Body

    // Phase 1: Go to nearest entry
    if (this.phase === Phase.GoingToEntry) {
      if (!this.entryTarget) this.entryTarget = this.findNearestEntry()

      if (this.entryTarget) {
        const d = Phaser.Math.Distance.Between(
          this.x,
          this.y,
          this.entryTarget.x,
          this.entryTarget.y
        )
        if (d > 40) {
          if (this.hasPathfinding()) {
            await this.ensurePathToWorld(
              this.entryTarget.x,
              this.entryTarget.y,
              time
            )
          }
          this.followPathOrSteerTo(this.entryTarget.x, this.entryTarget.y)
        } else {
          body.setVelocity(0)
          if (this.lootStartedAt === 0) {
            this.lootStartedAt = time
            this.lootWaitDuration = Phaser.Math.Between(
              LOOT_WAIT_MIN_MS,
              LOOT_WAIT_MAX_MS
            )
          }
          this.phase = Phase.Looting
        }
      }
      this.drawHealthBar()
      return
    }

    // Phase 2: Looting (wait, then equip)
    if (this.phase === Phase.Looting) {
      body.setVelocity(0)
      if (time - this.lootStartedAt >= this.lootWaitDuration) {
        this.equipRandomGear()
        this.entryTarget = null
        this.phase = Phase.Hunting
      }
      this.drawHealthBar()
      return
    }

    // Phase 3: Hunting
    if (this.phase === Phase.Hunting) {
      const newTarget = this.acquireTarget()
      if (newTarget !== this.target) {
        if (this.enemyGunType === "ak47" && this.gun instanceof Ak47)
          this.gun.stopFiring?.()
        this.target = newTarget
        this.goalTile = null
        this.path = []
      }

      let goalWorld: { x: number; y: number } | null = null
      if (this.target) {
        const dist = Phaser.Math.Distance.Between(
          this.x,
          this.y,
          this.target.x,
          this.target.y
        )
        const withinShoot = dist <= SHOOT_DISTANCE
        const withinStandoff =
          dist >= STANDOFF_DIST - STANDOFF_HYST &&
          dist <= STANDOFF_DIST + STANDOFF_HYST
        if (!withinShoot || !withinStandoff)
          goalWorld = this.standoffPointFromTarget(this.target.x, this.target.y)
      }

      if (goalWorld) {
        if (this.hasPathfinding()) {
          await this.ensurePathToWorld(goalWorld.x, goalWorld.y, time)
        }
        this.followPathOrSteerTo(goalWorld.x, goalWorld.y)
        this.applySeparation()

        const vlen = Math.hypot(body.velocity.x, body.velocity.y)
        if (vlen > CHASE_SPEED) {
          body.setVelocity(
            (body.velocity.x / vlen) * CHASE_SPEED,
            (body.velocity.y / vlen) * CHASE_SPEED
          )
        }
      } else {
        body.setVelocity(0)
      }

      // Shooting
      if (this.gun && this.target) {
        const dist = Phaser.Math.Distance.Between(
          this.x,
          this.y,
          this.target.x,
          this.target.y
        )
        const inRange = dist <= SHOOT_DISTANCE

        if (
          !inRange &&
          this.enemyGunType === "ak47" &&
          this.gun instanceof Ak47
        ) {
          this.gun.stopFiring?.()
        }

        if (inRange && time > this.lastShotTime + FIRE_COOLDOWN_MS) {
          if (this.gun.ammo <= 0) this.reload()
          if (this.enemyGunType === "ak47" && this.gun instanceof Ak47)
            this.gun.startFiring()
          this.gun.tryShoot(this, {
            worldX: this.target.x,
            worldY: this.target.y,
          } as Phaser.Input.Pointer)
          this.lastShotTime = time
        }
      }

      // Visual aim
      if (this.gun) {
        const lookX = this.target
          ? this.target.x
          : this.x + (body.velocity.x || 1)
        const lookY = this.target
          ? this.target.y
          : this.y + (body.velocity.y || 0)
        this.gun.x = 0
        this.gun.y = 0
        this.gun.rotation = Phaser.Math.Angle.Between(
          this.x,
          this.y,
          lookX,
          lookY
        )
        this.gun.update()
      }

      this.drawHealthBar()
      return
    }
  }

  private reload() {
    if (!this.gun) return
    const gunType = this.gun.gunType as GunKey
    const delay = GUN_RELOAD_TIME[gunType]
    this.scene.time.delayedCall(delay, () => {
      const amt = ammoAmounts[gunType] ?? 10
      this.gun!.addAmmo(amt)
    })
  }

  // ==== Damage / death ====
  public takeDamage(amount: number) {
    this.currentHealth -= amount
    if (this.currentHealth <= 0) {
      if (this.enemyGunType === "ak47" && this.gun instanceof Ak47)
        this.gun.stopFiring?.()
      this.phase = Phase.Dead
      this.scene.events.emit("enemy-killed", this)
      this.scene.enemies = this.scene.enemies.filter((e) => e !== this)
      this.healthBar.destroy()
      this.healthBarBg.destroy()
      this.destroy()
      return
    }
    if (
      this.hasHelmet &&
      this.currentHealth <= this.maxHealth - this.helmetHealth
    ) {
      this.hasHelmet = false
      this.helmetHealth = 0
      this.recalcMaxHealth()
    }
    if (this.hasVest && this.currentHealth <= 100) {
      this.hasVest = false
      this.vestHealth = 0
      this.recalcMaxHealth()
    }
    this.drawHealthBar()
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
  ) {
    const bullet = obj2 as Phaser.Physics.Arcade.Sprite & { damage?: number }
    const enemy = obj1 as unknown as Enemy
    const dmg = (bullet as any).damage ?? 10
    enemy.takeDamage(dmg)
    if ((bullet as any).destroy) (bullet as any).destroy()
  }
}
