import Phaser from "phaser"
import { ammoAmounts } from "../Constants"
import GameScene from "../scenes/GameScene"
import Ak47 from "./guns/Ak47"
import Gun from "./guns/Gun"
import Pistol from "./guns/Pistol"
import Shotgun from "./guns/Shotgun"
import Sniper from "./guns/Sniper"
import Player from "./Player"

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

  // 🔥 Health bar components
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

    // 🔥 Create health bar
    this.healthBarBg = scene.add.graphics()
    this.healthBar = scene.add.graphics()
    this.drawHealthBar()
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

    // Background (grey or black)
    this.healthBarBg.fillStyle(0x000000, 1)
    this.healthBarBg.fillRect(
      this.x - this.healthBarWidth / 2,
      this.y + this.healthBarOffsetY,
      this.healthBarWidth,
      this.healthBarHeight
    )

    // Health (red)
    this.healthBar.fillStyle(0xff0000, 1)
    this.healthBar.fillRect(
      this.x - this.healthBarWidth / 2,
      this.y + this.healthBarOffsetY,
      this.healthBarWidth * healthPercent,
      this.healthBarHeight
    )
  }

  public update(time: number, delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body

    const dx = this.player.x - this.x
    const dy = this.player.y - this.y
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.player.x,
      this.player.y
    )

    if (distance < 5000 && distance > 2500) {
      const angle = Math.atan2(dy, dx)
      const speed = 100
      body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
    } else {
      body.setVelocity(0)
    }

    if (distance <= 2500 && time > this.lastShotTime + 300) {
      if (this.gun.ammo <= 0) {
        this.gun.addAmmo(ammoAmounts[this.enemyChosenGun || "pistol"] || 10)
      }

      if (this.enemyChosenGun === "ak47") {
        ;(this.gun as Ak47).startFiring()
      }

      // this.gun.tryShoot(this, {
      //   worldX: this.player.x,
      //   worldY: this.player.y,
      // } as Phaser.Input.Pointer)

      this.lastShotTime = time
    }

    this.gun.x = 0
    this.gun.y = 0
    this.gun.rotation = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      this.player.x,
      this.player.y
    )
    this.gun.update()

    // 🔥 Update health bar position
    this.drawHealthBar()
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

      // Remove health bars
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
