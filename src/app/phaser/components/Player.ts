import * as Phaser from "phaser"
import { ammoAmounts } from "../Constants"
import { showTopLeftOverlayText } from "../HelperFunctions"
import GameScene from "../scenes/GameScene"
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

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key
    A: Phaser.Input.Keyboard.Key
    S: Phaser.Input.Keyboard.Key
    D: Phaser.Input.Keyboard.Key
  }

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

  constructor(scene: GameScene, x: number, y: number, size: number = 1) {
    super(scene, x, y)

    this.scene = scene
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

    scene.physics.world.enable(this)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(this.playerSprite.width, this.playerSprite.height)
    body.setOffset(-this.playerSprite.width / 2, -this.playerSprite.height / 2)
    body.collideWorldBounds = true

    this.setInteractive()
    scene.add.existing(this)

    this.setupControls()
    this.shooterType = "player"

    GameScene.totalPlayers += 1
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
  }

  public update(): void {
    if (!this.isAlive) return
    const body = this.body as Phaser.Physics.Arcade.Body
    if (!body) return

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

    body.velocity.normalize().scale(this.speed)

    const activeGun = this.getActiveGun()
    if (activeGun) {
      activeGun.x = this.x
      activeGun.y = this.y
      activeGun.rotateToPointer(this.scene.input.activePointer)
      activeGun.update()
      if (activeGun instanceof Ak47 && this.scene.input.activePointer.isDown) {
        activeGun.tryShoot(this, this.scene.input.activePointer)
      }
    }
  }

  private handleMouseDown(pointer: Phaser.Input.Pointer): void {
    const activeGun = this.getActiveGun()
    if (!activeGun) return
    if (activeGun instanceof Ak47) {
      activeGun.startFiring()
    } else {
      activeGun.tryShoot(this, pointer)
    }
  }

  private handleMouseUp(pointer: Phaser.Input.Pointer): void {
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
    gun.visible = false
    this.gunSlots[emptyIndex] = gun
    if (this.activeGunIndex === -1) {
      this.setActiveGun(emptyIndex)
    }
  }

  private createGunInstance(gunType: string): Gun | null {
    switch (gunType) {
      case "pistol":
        return new Pistol(this.scene, this.x, this.y)
      case "ak47":
        return new Ak47(this.scene, this.x, this.y)
      case "shotgun":
        return new Shotgun(this.scene, this.x, this.y)
      case "sniper":
        return new Sniper(this.scene, this.x, this.y)
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

  public setOverlappingGun(item: Phaser.GameObjects.Sprite) {
    this.overlappingGun = item
  }

  public tryPickup(item?: Phaser.GameObjects.Sprite & { pickupType?: string }) {
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

  public removeItemFromBag(key: string): void {
    const item = this.bag
      .getAll()
      .find((i) => (i as Phaser.GameObjects.Sprite).texture.key === key)
    if (item) item.destroy()
  }

  public toggleBag(): void {
    this.bag.visible = !this.bag.visible
  }
}
