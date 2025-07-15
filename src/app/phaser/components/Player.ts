import Phaser from "phaser"
import { showTopLeftOverlayText } from "../HelperFunctions"

export default class Player extends Phaser.GameObjects.Container {
  private playerSprite: Phaser.GameObjects.Sprite
  private guns: Phaser.GameObjects.Container
  private helmet: Phaser.GameObjects.Container
  private vest: Phaser.GameObjects.Container
  private bag: Phaser.GameObjects.Container
  private activeGunIndex: number

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key
    A: Phaser.Input.Keyboard.Key
    S: Phaser.Input.Keyboard.Key
    D: Phaser.Input.Keyboard.Key
  }

  private speed: number = 200

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

    // Normalize diagonal movement
    body.velocity.normalize().scale(this.speed)
  }

  public addGun(gunSpriteKey: string): void {
    const gun = this.scene.add.sprite(0, 0, gunSpriteKey)
    gun.setOrigin(0.5, 0.5)
    gun.setPosition(120, 130) // Adjust position to where it should appear on the body
    gun.visible = false
    this.guns.add(gun)

    if (this.guns.length === 1) {
      console.log("GOING TO SET ACTGIVE")
      this.setActiveGun(0)
    }

    console.log("GUN ADDED")
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
      .setOrigin(0.5, 0.5)
    helmet.setPosition(-10, -100)
    this.helmet.add(helmet)
  }

  public equipVest(vestSpriteKey: string): void {
    this.vest.removeAll(true)
    const vest = this.scene.add.sprite(0, 0, vestSpriteKey).setOrigin(0.5, 0.5)
    vest.setPosition(2, 78)
    this.vest.add(vest)
  }

  public addItemToBag(itemSpriteKey: string): void {
    const item = this.scene.add.sprite(0, 0, itemSpriteKey)
    this.bag.add(item)
  }

  public toggleBag(): void {
    this.bag.visible = !this.bag.visible
  }

  public tryPickup(
    item: Phaser.GameObjects.Sprite & { pickupType?: string }
  ): void {
    switch (item.pickupType) {
      case "gun":
        if (this.guns.getAll().length === 3) {
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
  }
}
