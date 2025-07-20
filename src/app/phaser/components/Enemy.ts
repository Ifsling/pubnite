// Enemy.ts
import Phaser from "phaser"
import { ammoAmounts } from "../Constants"
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
  private currentHealth: number = 100
  private player: Player
  private lastShotTime: number = 0
  private enemyChosenGun: string | null = null

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
    super(scene, x, y)
    this.player = player

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
    const gunTypes = ["pistol", "ak47", "shotgun", "sniper"]
    // const gunTypes = ["ak47"]
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

      this.gun.tryShoot({
        worldX: this.player.x,
        worldY: this.player.y,
      } as Phaser.Input.Pointer)
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
      this.destroy()
      this.scene.events.emit("enemy-killed")
    }
  }

  public getHealth() {
    return this.currentHealth
  }
}
