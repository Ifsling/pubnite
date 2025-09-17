import * as Phaser from "phaser"
import { ammoAmounts, PickupType } from "../Constants"
import { showTopLeftOverlayText } from "../HelperFunctions"
import GameScene from "../scenes/GameScene"
import type Enemy from "./Enemy"
import Ak47 from "./guns/Ak47"
import Gun from "./guns/Gun"
import Pistol from "./guns/Pistol"
import Shotgun from "./guns/Shotgun"
import Sniper from "./guns/Sniper"

export default class Player extends Phaser.GameObjects.Container {
  private playerSprite: Phaser.GameObjects.Sprite
  private gunSlots: (Gun | null)[]
  private gunsContainer: Phaser.GameObjects.Container
  private helmet: Phaser.GameObjects.Container
  private vest: Phaser.GameObjects.Container
  private bag: Phaser.GameObjects.Container
  private activeGunIndex: number
  private overlappingGun: Phaser.GameObjects.Sprite | null = null

  public scene: GameScene
  public shooterType: "player" | "enemy"
  public isAlive: boolean = true

  // --- Grenade aim state ---
  private grenadeArmed = false
  private aimingGrenade = false
  private armBlockUntil = 0
  private aimDots: Phaser.GameObjects.Arc[] = []
  private bombIcon?: Phaser.GameObjects.Image

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key
    A: Phaser.Input.Keyboard.Key
    S: Phaser.Input.Keyboard.Key
    D: Phaser.Input.Keyboard.Key
  }

  private defaultSpeed: number = 500
  private speed: number = 500
  private maxHealth: number = 100
  private currentHealth: number = 100
  private hasHelmet: boolean = false
  private hasVest: boolean = false
  private helmetHealth: number = 0
  private vestHealth: number = 0

  private ammoStorage: { [key: string]: number } = {
    pistol: 0,
    ak47: 0,
    shotgun: 0,
    sniper: 0,
  }

  // --- Slip state (prevents update() from zeroing the velocity) ---
  private slipUntil: number = 0
  private slipVel: Phaser.Math.Vector2 | null = null

  constructor(
    scene: GameScene,
    x: number,
    y: number,
    size: number = 1,
    speed?: number
  ) {
    super(scene, x, y)

    this.scene = scene

    // Character sprite lives inside the container
    this.playerSprite = scene.add.sprite(0, 0, "player").setScale(size)
    this.add(this.playerSprite)

    this.gunsContainer = scene.add.container(0, 0)
    this.add(this.gunsContainer)
    this.gunSlots = [null, null, null]
    this.activeGunIndex = -1

    this.helmet = scene.add.container(0, -30)
    this.add(this.helmet)

    this.vest = scene.add.container(0, 20)
    this.add(this.vest)

    this.bag = scene.add.container(0, 50)
    this.bag.visible = false
    this.add(this.bag)

    // Physics on the player container; body sized to the *sprite*, not children.
    scene.physics.world.enable(this)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(true)
    this.syncBodyToSprite()

    this.setInteractive()
    scene.add.existing(this)

    this.setupControls()
    this.shooterType = "player"

    GameScene.totalPlayers += 1

    if (speed) this.speed = speed
    else this.speed = this.defaultSpeed
  }

  // --- Ensure the hitbox stays tightly around the character sprite (not guns).
  private syncBodyToSprite() {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (!body || !this.playerSprite) return

    // Use display size (accounts for container + sprite scale)
    const w = this.playerSprite.displayWidth
    const h = this.playerSprite.displayHeight

    body.setSize(w, h)
    // Center the body on the container origin (0,0 is sprite center)
    body.setOffset(-w / 2, -h / 2)
  }

  // Override setScale so RoomManager’s scaling auto-fixes the hitbox.
  public override setScale(x: number, y?: number): this {
    super.setScale(x, y ?? x)
    this.syncBodyToSprite()
    return this
  }

  private setupControls(): void {
    this.cursors = this.scene!.input!.keyboard!.createCursorKeys()
    this.wasdKeys = this.scene!.input!.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as any

    this.scene!.input!.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (!this.isAlive) return
      switch (event.key) {
        case "1":
          this.setActiveGun(0)
          break
        case "2":
          this.setActiveGun(1)
          break
        case "3":
          this.setActiveGun(2)
          break
        case "g":
        case "G":
          this.tryPickup()
          break
        case "r":
        case "R":
          this.reloadActiveGun()
          break
      }
    })

    this.scene!.input!.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.isAlive) return
      this.handleMouseDown(pointer)
    })

    this.scene!.input!.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.isAlive) return
      this.handleMouseUp(pointer)
    })

    this.scene!.input!.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.isAlive || !this.aimingGrenade) return
      const origin = new Phaser.Math.Vector2(this.x, this.y)
      const aimPt =
        this.scene.roomManager?.getAimWorld(pointer) ??
        new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
      const to = new Phaser.Math.Vector2(aimPt.x, aimPt.y)
      const vel = this.getAimVelocity(origin, to)
      this.renderAimDots(origin, vel)
    })
  }

  public update(): void {
    if (!this.isAlive) return
    const body = this.body as Phaser.Physics.Arcade.Body
    if (!body) return

    const now = this.scene.time.now

    // If slipping, force slip velocity and skip input movement for the duration.
    if (now < this.slipUntil && this.slipVel) {
      body.setVelocity(this.slipVel.x, this.slipVel.y)
    } else {
      // normal movement path
      body.setVelocity(0)

      if (this.wasdKeys.A.isDown || this.cursors.left.isDown) {
        body.setVelocityX(-this.speed)
      } else if (this.wasdKeys.D.isDown || this.cursors.right.isDown) {
        body.setVelocityX(this.speed)
      }

      if (this.wasdKeys.W.isDown || this.cursors.up.isDown) {
        body.setVelocityY(-this.speed)
      } else if (this.wasdKeys.S.isDown || this.cursors.down.isDown) {
        body.setVelocityY(this.speed)
      }

      if (body.velocity.lengthSq() > 0) {
        body.velocity.normalize().scale(this.speed)
      }

      // clear slip state if any
      this.slipUntil = 0
      this.slipVel = null
    }

    if (this.bombIcon) this.bombIcon.setPosition(this.x, this.y - 60)

    // Aim & fire
    const activeGun = this.getActiveGun()
    if (activeGun) {
      // The gun is a child of the player (at local 0,0). Rotate it toward pointer using world coords.
      const pointer = this.scene.input.activePointer

      const aimPt =
        this.scene.roomManager?.getAimWorld(pointer) ??
        new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
      const angle = Phaser.Math.Angle.Between(this.x, this.y, aimPt.x, aimPt.y)

      activeGun.setRotation(angle)
      activeGun.update()

      if (activeGun instanceof Ak47 && pointer.isDown) {
        activeGun.tryShoot(this, pointer)
      }
    }
  }

  private handleMouseDown(pointer: Phaser.Input.Pointer): void {
    // ignore the down that came from clicking USE
    if (this.scene.time.now < this.armBlockUntil) return

    if (this.grenadeArmed && !this.aimingGrenade) {
      this.aimingGrenade = true
      const origin = new Phaser.Math.Vector2(this.x, this.y)
      const to = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
      const vel = this.getAimVelocity(origin, to)
      this.renderAimDots(origin, vel)
      return
    }

    if (this.aimingGrenade) return

    const activeGun = this.getActiveGun()
    if (!activeGun) return
    if (activeGun instanceof Ak47) {
      activeGun.startFiring()
    } else {
      activeGun.tryShoot(this, pointer)
    }
  }

  private handleMouseUp(pointer: Phaser.Input.Pointer): void {
    // ignore the up that came from clicking USE
    if (this.scene.time.now < this.armBlockUntil) return

    if (this.aimingGrenade) {
      const origin = new Phaser.Math.Vector2(this.x, this.y)

      const aimPt =
        this.scene.roomManager?.getAimWorld(pointer) ??
        new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
      const to = new Phaser.Math.Vector2(aimPt.x, aimPt.y)

      const vel = this.getAimVelocity(origin, to)
      this.throwGrenade(vel)
      this.grenadeArmed = false
      return
    }

    if (this.grenadeArmed) return

    const activeGun = this.getActiveGun()
    if (activeGun instanceof Ak47) {
      activeGun.stopFiring()
    }
  }

  private reloadActiveGun(): void {
    const activeGun = this.getActiveGun()
    if (!activeGun) return
    const availableAmmo = this.ammoStorage[activeGun.gunType]
    if (availableAmmo <= 0) {
      showTopLeftOverlayText(this.scene, "No ammo available!", 20, 70, 2000)
      return
    }
    const ammoNeeded = activeGun.maxAmmo - activeGun.ammo
    const ammoToGive = Math.min(ammoNeeded, availableAmmo)
    if (ammoToGive > 0) {
      activeGun.addAmmo(ammoToGive)
      this.ammoStorage[activeGun.gunType] -= ammoToGive
      showTopLeftOverlayText(
        this.scene,
        `Reloaded ${ammoToGive} rounds`,
        20,
        70,
        2000
      )
    }
  }

  public addGun(gunSpriteKey: string): void {
    const emptyIndex = this.gunSlots.findIndex((slot) => slot === null)
    if (emptyIndex === -1) {
      showTopLeftOverlayText(
        this.scene,
        "You can only carry 3 guns at a time.",
        20,
        70,
        3000
      )
      return
    }
    const gun = this.createGunInstance(gunSpriteKey)
    if (!gun) return

    // Parent the gun to the *player’s gunsContainer* so it inherits scale/position.
    gun.setPosition(0, 0)
    this.gunsContainer.add(gun)
    gun.visible = false

    this.gunSlots[emptyIndex] = gun
    if (this.activeGunIndex === -1) {
      this.setActiveGun(emptyIndex)
    }
  }

  private createGunInstance(gunType: string): Gun | null {
    // Create at (0,0). We'll parent it into the gunsContainer.
    switch (gunType) {
      case "pistol":
        return new Pistol(this.scene, 0, 0)
      case "ak47":
        return new Ak47(this.scene, 0, 0)
      case "shotgun":
        return new Shotgun(this.scene, 0, 0)
      case "sniper":
        return new Sniper(this.scene, 0, 0)
      default:
        return null
    }
  }

  public setActiveGun(index: number): void {
    const gun = this.gunSlots[index]
    if (!gun) return
    this.gunSlots.forEach((g, i) => {
      if (g) g.visible = i === index
    })
    this.activeGunIndex = index
  }

  public getActiveGun(): Gun | null {
    return this.gunSlots[this.activeGunIndex] || null
  }

  public getAllGunKeys(): (string | null)[] {
    return this.gunSlots.map((gun) => (gun ? gun.gunType : null))
  }

  public removeGunAtIndex(index: number): void {
    const gun = this.gunSlots[index]
    if (gun) {
      gun.destroy()
      this.gunSlots[index] = null
      if (this.activeGunIndex === index) {
        this.activeGunIndex = -1
      }
    }
  }

  public setSpeed(newSpeed: number): void {
    if (newSpeed === -1) {
      this.speed = this.defaultSpeed
    } else {
      this.speed = newSpeed
    }
  }

  public setOverlappingGun(item: Phaser.GameObjects.Sprite) {
    this.overlappingGun = item
  }

  public tryPickup(
    item?: Phaser.GameObjects.Sprite & { pickupType?: PickupType }
  ) {
    if (!item && this.overlappingGun) {
      item = this.overlappingGun
    }
    if (!item) return
    switch (item.pickupType) {
      case "gun":
        this.addGun(item.texture.key)
        break
      case "helmet":
        this.equipHelmet(item.texture.key)
        break
      case "vest":
        this.equipVest(item.texture.key)
        break
      case "bagItem":
        this.addItemToBag(item.texture.key)
        break
      case "ammo":
        this.addAmmoToStorage(item.texture.key)
        break
    }
    item.destroy()
    if (item === this.overlappingGun) this.overlappingGun = null
  }

  private addAmmoToStorage(ammoType: string): void {
    const ammoMap: { [key: string]: string } = {
      pistol_ammo: "pistol",
      ak47_ammo: "ak47",
      shotgun_ammo: "shotgun",
      sniper_ammo: "sniper",
    }
    const gunType = ammoMap[ammoType]
    if (gunType) {
      const ammoAmount = this.getAmmoAmount(gunType)
      this.ammoStorage[gunType] += ammoAmount
      showTopLeftOverlayText(
        this.scene,
        `+${ammoAmount} ${gunType.toUpperCase()} ammo`,
        20,
        70,
        2000
      )
    }
  }

  private getAmmoAmount(gunType: string): number {
    return ammoAmounts[gunType] || 0
  }

  public getAmmoStorage(): { [key: string]: number } {
    return this.ammoStorage
  }

  public equipHelmet(helmetSpriteKey: string): void {
    this.helmet.removeAll(true)
    const helmet = this.scene.add
      .sprite(-10, -100, helmetSpriteKey)
      .setOrigin(0.5)
    this.helmet.add(helmet)
    this.hasHelmet = true
    this.helmetHealth = 50
    this.recalculateMaxHealth()
  }

  public equipVest(vestSpriteKey: string): void {
    this.vest.removeAll(true)
    const vest = this.scene.add.sprite(2, 78, vestSpriteKey).setOrigin(0.5)
    this.vest.add(vest)
    this.hasVest = true
    this.vestHealth = 60
    this.recalculateMaxHealth()
  }

  private recalculateMaxHealth(): void {
    const oldMax = this.maxHealth
    this.maxHealth = 100
    if (this.hasHelmet) this.maxHealth += 50
    if (this.hasVest) this.maxHealth += 60
    if (this.maxHealth > oldMax) {
      this.currentHealth += this.maxHealth - oldMax
      this.currentHealth = Math.min(this.currentHealth, this.maxHealth)
    } else {
      this.currentHealth = Math.min(this.currentHealth, this.maxHealth)
    }
  }

  private removeHelmet(): void {
    this.helmet.removeAll(true)
    this.hasHelmet = false
    this.helmetHealth = 0
    this.recalculateMaxHealth()
  }

  private removeVest(): void {
    this.vest.removeAll(true)
    this.hasVest = false
    this.vestHealth = 0
    this.recalculateMaxHealth()
  }

  public getHealth(): number {
    return this.currentHealth
  }

  public addHealth(amount: number): void {
    this.currentHealth += amount
    if (this.currentHealth > this.maxHealth) {
      this.currentHealth = this.maxHealth
    }
  }

  public takeDamage(amount: number): void {
    this.currentHealth -= amount
    if (this.currentHealth < 0) this.currentHealth = 0
    this.recalculateMaxHealth()
    if (this.currentHealth === 0) {
      this.killPlayer()
    }
  }

  public killPlayer(): void {
    if (!this.isAlive) return
    this.isAlive = false

    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      body.stop()
      body.enable = false
    }

    this.removeAllListeners()
    this.playerSprite.destroy()
    this.gunsContainer.destroy()
    this.helmet.destroy()
    this.vest.destroy()
    this.bag.destroy()

    this.scene.events.emit("player-dead")
    this.scene.events.emit("enemy-killed", this)

    this.destroy(true)
  }

  public override removeAllListeners(event?: string | symbol): this {
    super.removeAllListeners(event)
    return this
  }

  public addItemToBag(itemSpriteKey: string): void {
    const item = this.scene.add.sprite(0, 0, itemSpriteKey)
    this.bag.add(item)
  }

  public getBagItems(): string[] {
    return this.bag
      .getAll()
      .map((i) => (i as Phaser.GameObjects.Sprite).texture.key)
  }

  public handleFasterBoi() {
    // increase speed for 5 seconds
    this.speed = this.defaultSpeed * 1.8
    this.scene.time.delayedCall(5000, () => {
      this.speed = this.defaultSpeed
    })
  }

  public handleSlipTrap() {
    let nearestDistance = Infinity
    let nearestEnemy: Enemy | null = null

    const enemies = this.scene.enemies as Enemy[]
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]
      const dist = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y)
      if (dist < nearestDistance) {
        nearestDistance = dist
        nearestEnemy = e
      }
    }

    if (nearestEnemy) {
      const angle = Phaser.Math.Angle.Between(
        this.x,
        this.y,
        nearestEnemy.x,
        nearestEnemy.y
      )
      const pushSpeed = 600
      const vx = Math.cos(angle) * pushSpeed
      const vy = Math.sin(angle) * pushSpeed

      // Lock slip for 4 seconds; update() will enforce this velocity every frame.
      this.slipUntil = this.scene.time.now + 4000
      this.slipVel = new Phaser.Math.Vector2(vx, vy)

      // Optional safety stop after 4s
      this.scene.time.delayedCall(4000, () => {
        const body = this.body as Phaser.Physics.Arcade.Body
        if (body) body.setVelocity(0)
        this.slipUntil = 0
        this.slipVel = null
      })
    }
  }

  public removeItemFromBag(key: string): void {
    const item = this.bag
      .getAll()
      .find((i) => (i as Phaser.GameObjects.Sprite).texture.key === key)
    if (item) item.destroy()
  }

  public toggleBag(): void {
    this.bag.visible = !this.bag.visible
  }

  private getAimVelocity(from: Phaser.Math.Vector2, to: Phaser.Math.Vector2) {
    // drag opposite direction → throw farther
    const dir = new Phaser.Math.Vector2(from.x - to.x, from.y - to.y)
    const len = Phaser.Math.Clamp(dir.length(), 0, 320) // max drag
    dir.normalize().scale(len * 6) // tune throw power
    return dir // pixels/sec
  }

  private renderAimDots(origin: Phaser.Math.Vector2, vel: Phaser.Math.Vector2) {
    // clear old
    for (const d of this.aimDots) d.destroy()
    this.aimDots.length = 0

    const steps = 18
    const dt = 0.05 // preview step (s) – straight line feel (top-down)
    for (let i = 1; i <= steps; i++) {
      const t = i * dt
      const px = origin.x + vel.x * t
      const py = origin.y + vel.y * t
      const dot = this.scene.add.circle(
        px,
        py,
        3,
        0xffffff,
        Phaser.Math.Linear(0.9, 0.2, i / steps)
      )
      dot.setDepth(9999).setScrollFactor(1)
      this.aimDots.push(dot)
    }
  }

  private clearAimDots() {
    for (const d of this.aimDots) d.destroy()
    this.aimDots.length = 0
  }

  public startGrenadeAim() {
    if (!this.isAlive) return

    this.grenadeArmed = true
    this.aimingGrenade = false

    // block current click cycle (the USE click)
    this.armBlockUntil = this.scene.time.now + 150

    // show icon
    this.bombIcon?.destroy()
    this.bombIcon = this.scene.add
      .image(this.x, this.y - 60, "boomnut-no-glow")
      .setScale(0.6)
      .setDepth(9999)

    // clear any old dots
    this.clearAimDots()
  }

  private throwGrenade(vel: Phaser.Math.Vector2) {
    // Lazy import to avoid circular deps—adjust path if needed
    const Grenade = require("./Grenade").default as any
    new Grenade(this.scene as any, this.x, this.y, vel)

    this.aimingGrenade = false
    this.clearAimDots()
    this.bombIcon?.destroy()
    this.bombIcon = undefined
  }
}
