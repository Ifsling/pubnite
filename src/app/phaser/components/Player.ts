import Phaser from "phaser"
import { showTopLeftOverlayText } from "../HelperFunctions"

export default class Player extends Phaser.GameObjects.Container {
  private playerSprite: Phaser.GameObjects.Sprite
  private guns: Phaser.GameObjects.Container
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

  // Health-related
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
    this.guns = scene.add.container(0, 0)
    this.guns.name = "guns"
    this.activeGunIndex = -1
    this.add(this.guns)

    // Helmet
    this.helmet = scene.add.container(0, -30)
    this.helmet.name = "helmet"
    this.add(this.helmet)

    // Vest
    this.vest = scene.add.container(0, 20)
    this.vest.name = "vest"
    this.add(this.vest)

    // Bag
    this.bag = scene.add.container(0, 50)
    this.bag.name = "bag"
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

    // Movement keys
    this.cursors = scene!.input!.keyboard!.createCursorKeys()
    this.wasdKeys = scene!.input!.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as {
      W: Phaser.Input.Keyboard.Key
      A: Phaser.Input.Keyboard.Key
      S: Phaser.Input.Keyboard.Key
      D: Phaser.Input.Keyboard.Key
    }
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
    const gun = this.scene.add.sprite(0, 0, gunSpriteKey)
    gun.setOrigin(0.5, 0.5)
    gun.setPosition(120, 130)
    gun.visible = false
    this.guns.add(gun)

    if (this.guns.length === 1) {
      this.setActiveGun(0)
    }
  }

  public setActiveGun(index: number): void {
    this.guns.getAll().forEach((gun, i) => {
      if (gun instanceof Phaser.GameObjects.Sprite) {
        gun.visible = i === index
      }
    })
    this.activeGunIndex = index
  }

  public getActiveGun(): Phaser.GameObjects.Sprite | null {
    const gun = this.guns.getAt(this.activeGunIndex)
    return gun instanceof Phaser.GameObjects.Sprite ? gun : null
  }

  public equipHelmet(helmetSpriteKey: string): void {
    this.helmet.removeAll(true)
    const helmet = this.scene.add
      .sprite(0, 0, helmetSpriteKey)
      .setOrigin(0.5)
      .setPosition(-10, -100)
    this.helmet.add(helmet)

    this.hasHelmet = true
    this.helmetHealth = 50
    this.recalculateMaxHealth()
  }

  public equipVest(vestSpriteKey: string): void {
    this.vest.removeAll(true)
    const vest = this.scene.add
      .sprite(0, 0, vestSpriteKey)
      .setOrigin(0.5)
      .setPosition(2, 78)
    this.vest.add(vest)

    this.hasVest = true
    this.vestHealth = 60
    this.recalculateMaxHealth()
  }

  public getHealth(): number {
    return this.currentHealth
  }

  private recalculateMaxHealth(): void {
    const oldMax = this.maxHealth
    this.maxHealth = 100
    if (this.hasHelmet) this.maxHealth += 50
    if (this.hasVest) this.maxHealth += 60

    // If gear was added (not removed), boost current health too
    if (this.maxHealth > oldMax) {
      this.currentHealth += this.maxHealth - oldMax
      if (this.currentHealth > this.maxHealth) {
        this.currentHealth = this.maxHealth
      }
    }

    // Clamp health to new max if gear was removed
    if (this.currentHealth > this.maxHealth) {
      this.currentHealth = this.maxHealth
    }
  }

  public takeDamage(amount: number): void {
    if (this.hasHelmet && this.hasVest) {
      if (this.helmetHealth >= this.vestHealth) {
        this.helmetHealth -= amount
      } else {
        this.vestHealth -= amount
      }
      this.currentHealth -= amount

      if (this.currentHealth <= 150) {
        if (this.helmetHealth < this.vestHealth && this.hasHelmet) {
          this.removeHelmet()
        } else if (this.hasVest) {
          this.removeVest()
        }
      }

      if (this.currentHealth <= 100) {
        this.removeHelmet()
        this.removeVest()
      }
    } else if (this.hasVest) {
      this.vestHealth -= amount
      this.currentHealth -= amount
      if (this.vestHealth <= 0 || this.currentHealth <= 100) {
        this.removeVest()
      }
    } else if (this.hasHelmet) {
      this.helmetHealth -= amount
      this.currentHealth -= amount
      if (this.helmetHealth <= 0 || this.currentHealth <= 100) {
        this.removeHelmet()
      }
    } else {
      this.currentHealth -= amount
    }

    if (this.currentHealth < 0) this.currentHealth = 0

    this.recalculateMaxHealth()
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

  public addItemToBag(itemSpriteKey: string): void {
    console.log(itemSpriteKey)
    const item = this.scene.add.sprite(0, 0, itemSpriteKey)
    this.bag.add(item)
    console.log(this.bag.getAll())
  }

  public getBagItems(): string[] {
    console.log(this.bag)
    return this.bag
      .getAll()
      .map((i) => (i as Phaser.GameObjects.Sprite).texture.key)
  }

  public removeItemFromBag(key: string): void {
    const item = this.bag
      .getAll()
      .find((i) => (i as Phaser.GameObjects.Sprite).texture.key === key)
    if (item) {
      item.destroy()
    }
  }

  public toggleBag(): void {
    this.bag.visible = !this.bag.visible
  }

  public getAllGunKeys(): (string | null)[] {
    const guns = this.guns.getAll() as Phaser.GameObjects.Sprite[]
    const keys: (string | null)[] = [null, null, null]

    guns.forEach((gun, index) => {
      keys[index] = gun.texture.key
    })

    return keys
  }

  public removeGunAtIndex(index: number): void {
    const gun = this.guns.getAt(index)
    if (gun) {
      gun.destroy()
      if (this.activeGunIndex === index) this.activeGunIndex = -1
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
        if (this.guns.getAll().length >= 3) {
          showTopLeftOverlayText(
            this.scene,
            "You can only carry 3 guns at a time.",
            20,
            70,
            5000
          )
          return
        }
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
}
