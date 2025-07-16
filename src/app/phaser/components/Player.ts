import Phaser from "phaser"
import { showTopLeftOverlayText } from "../HelperFunctions"

export default class Player extends Phaser.GameObjects.Container {
  private playerSprite: Phaser.GameObjects.Sprite
  private gunSlots: (Phaser.GameObjects.Sprite | null)[]
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

    // Controls
    this.cursors = scene!.input!.keyboard!.createCursorKeys()
    this.wasdKeys = scene!.input!.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as any

    // Gun switching with keys 1-3
    scene!.input!.keyboard!.on("keydown", (event: KeyboardEvent) => {
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
      }
    })
  }

  public update(): void {
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

    const gun = this.scene.add.sprite(120, 130, gunSpriteKey)
    gun.setOrigin(0.5, 0.5)
    gun.visible = false
    this.gunsContainer.add(gun)
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

  public getActiveGun(): Phaser.GameObjects.Sprite | null {
    return this.gunSlots[this.activeGunIndex]
  }

  public getAllGunKeys(): (string | null)[] {
    return this.gunSlots.map((gun) => (gun ? gun.texture.key : null))
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
    }

    item.destroy()
    if (item === this.overlappingGun) this.overlappingGun = null
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
