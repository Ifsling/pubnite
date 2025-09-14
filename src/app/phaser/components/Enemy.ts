import * as Phaser from "phaser"
import { ammoAmounts } from "../Constants"
import GameScene from "../scenes/GameScene"
import Ak47 from "./guns/Ak47"
import Gun, { GUN_RELOAD_TIME } from "./guns/Gun"
import Pistol from "./guns/Pistol"
import Shotgun from "./guns/Shotgun"
import Sniper from "./guns/Sniper"
import type Player from "./Player"

// ==== TUNABLE CONSTANTS (top of file) ====
const FOLLOW_DISTANCE = 2000 // start chasing if player is within this distance
const SHOOT_DISTANCE = 900 // start shooting if player is within this distance
const CHASE_SPEED = 140 // enemy movement speed while chasing
const FIRE_COOLDOWN_MS = 300 // min ms between shots (all guns)
// =========================================

export default class Enemy extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Sprite
  private gun: Gun
  private hasHelmet: boolean = false
  private hasVest: boolean = false
  private helmetHealth: number = 0
  private vestHealth: number = 0
  private maxHealth: number = 100
  private currentHealth: number = 10
  private player: Player
  private lastShotTime: number = 0
  private enemyChosenGun: string | null = null

  public scene: GameScene
  public shooterType: "player" | "enemy"

  // Health bar components
  private healthBarBg: Phaser.GameObjects.Graphics
  private healthBar: Phaser.GameObjects.Graphics
  private healthBarWidth: number = 40
  private healthBarHeight: number = 6
  private healthBarOffsetY: number = -50

  constructor(scene: GameScene, x: number, y: number, player: Player) {
    super(scene, x, y)
    this.player = player

    this.sprite = scene.add.sprite(0, 0, "villian")
    this.add(this.sprite)

    this.scene = scene

    // Random equipment
    const equipmentRoll = Phaser.Math.Between(0, 2)
    if (equipmentRoll === 1) this.equipHelmet()
    else if (equipmentRoll === 2) {
      this.equipHelmet()
      this.equipVest()
    }

    this.recalculateMaxHealth()

    // Random gun
    const gunTypes = ["pistol", "ak47", "shotgun", "sniper"]
    const chosenGun = gunTypes[Phaser.Math.Between(0, gunTypes.length - 1)]
    this.enemyChosenGun = chosenGun
    this.gun = this.createGun(chosenGun)
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

    scene.enemies.push(this)
  }

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
    this.maxHealth = 100
    if (this.hasHelmet) this.maxHealth += this.helmetHealth
    if (this.hasVest) this.maxHealth += this.vestHealth
    this.currentHealth = this.maxHealth
  }

  private drawHealthBar() {
    const healthPercent = Phaser.Math.Clamp(
      this.currentHealth / this.maxHealth,
      0,
      1
    )
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
        this.healthBarWidth * healthPercent,
        this.healthBarHeight
      )
  }

  public update(time: number, _delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body

    const dx = this.player.x - this.x
    const dy = this.player.y - this.y
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.player.x,
      this.player.y
    )

    // --- Movement ---
    if (distance <= FOLLOW_DISTANCE && distance > SHOOT_DISTANCE) {
      const angle = Math.atan2(dy, dx)
      body.setVelocity(
        Math.cos(angle) * CHASE_SPEED,
        Math.sin(angle) * CHASE_SPEED
      )
    } else {
      body.setVelocity(0)
    }

    // --- Shooting ---
    const inShootRange = distance <= SHOOT_DISTANCE
    if (!inShootRange && this.enemyChosenGun === "ak47") {
      // stop autofire once out of range
      ;(this.gun as Ak47).stopFiring?.()
    }

    if (inShootRange && time > this.lastShotTime + FIRE_COOLDOWN_MS) {
      if (this.gun.ammo <= 0) this.reload(this.enemyChosenGun)

      if (this.enemyChosenGun === "ak47") {
        ;(this.gun as Ak47).startFiring()
      }

      if (this.player.isAlive) {
        this.gun.tryShoot(this, {
          worldX: this.player.x,
          worldY: this.player.y,
        } as Phaser.Input.Pointer)
        this.lastShotTime = time
      }
    }

    // Gun orientation
    this.gun.x = 0
    this.gun.y = 0
    this.gun.rotation = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      this.player.x,
      this.player.y
    )
    this.gun.update()

    // Health bar position
    this.drawHealthBar()
  }

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

  public takeDamage(amount: number) {
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
