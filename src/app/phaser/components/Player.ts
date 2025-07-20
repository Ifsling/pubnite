import Phaser from "phaser"
import { ammoAmounts } from "../Constants"
import { showTopLeftOverlayText } from "../HelperFunctions"
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

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key
    A: Phaser.Input.Keyboard.Key
    S: Phaser.Input.Keyboard.Key
    D: Phaser.Input.Keyboard.Key
  }

  private speed: number = 200
  private maxHealth: number = 100
  private currentHealth: number = 100
  private hasHelmet: boolean = false
  private hasVest: boolean = false
  private helmetHealth: number = 0
  private vestHealth: number = 0

  // Ammo storage
  private ammoStorage: { [key: string]: number } = {
    pistol: 0,
    ak47: 0,
    shotgun: 0,
    sniper: 0,
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    // Player sprite
    this.playerSprite = scene.add.sprite(0, 0, "player")
    this.add(this.playerSprite)

    // Guns
    this.gunsContainer = scene.add.container(0, 0)
    this.add(this.gunsContainer)
    this.gunSlots = [null, null, null]
    this.activeGunIndex = -1

    // Helmet
    this.helmet = scene.add.container(0, -30)
    this.add(this.helmet)

    // Vest
    this.vest = scene.add.container(0, 20)
    this.add(this.vest)

    // Bag
    this.bag = scene.add.container(0, 50)
    this.bag.visible = false
    this.add(this.bag)

    // Physics
    scene.physics.world.enable(this)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setSize(this.playerSprite.width, this.playerSprite.height)
    body.setOffset(-this.playerSprite.width / 2, -this.playerSprite.height / 2)
    body.collideWorldBounds = true

    this.setInteractive()
    scene.add.existing(this)

    this.setupControls()
  }

  private setupControls(): void {
    // Movement controls
    this.cursors = this.scene!.input!.keyboard!.createCursorKeys()
    this.wasdKeys = this.scene!.input!.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as any

    // Gun switching and pickup
    this.scene!.input!.keyboard!.on("keydown", (event: KeyboardEvent) => {
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

    // Mouse controls for shooting
    this.scene!.input!.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.handleMouseDown(pointer)
    })

    this.scene!.input!.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.handleMouseUp(pointer)
    })
  }

  private handleMouseDown(pointer: Phaser.Input.Pointer): void {
    const activeGun = this.getActiveGun()
    if (!activeGun) return

    if (activeGun instanceof Ak47) {
      ;(activeGun as Ak47).startFiring()
    } else {
      activeGun.tryShoot(pointer)
    }
  }

  private handleMouseUp(pointer: Phaser.Input.Pointer): void {
    const activeGun = this.getActiveGun()
    if (activeGun instanceof Ak47) {
      ;(activeGun as Ak47).stopFiring()
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

  public update(): void {
    // Movement
    const body = this.body as Phaser.Physics.Arcade.Body
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

    // Update active gun
    const activeGun = this.getActiveGun()
    if (activeGun) {
      activeGun.x = this.x
      activeGun.y = this.y
      activeGun.rotateToPointer(this.scene.input.activePointer)
      activeGun.update()

      // Handle automatic firing for AK47
      if (activeGun instanceof Ak47 && this.scene.input.activePointer.isDown) {
        activeGun.tryShoot(this.scene.input.activePointer)
      }
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
    // Map ammo sprites to gun types
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

  // Rest of your existing methods...
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
