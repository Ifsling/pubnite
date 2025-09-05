import Phaser from "phaser"
import GameScene from "../../scenes/GameScene"
import type Enemy from "../Enemy"
import type Player from "../Player"

export interface BulletType {
  sprite: string
  damage: number
  speed: number
  scale?: number
}

export default abstract class Gun extends Phaser.GameObjects.Sprite {
  public ammo: number
  public maxAmmo: number
  protected cooldown: number
  protected lastShot: number = 0
  protected bulletType: BulletType
  public gunType: string

  public gameScene: GameScene

  constructor(
    scene: GameScene,
    x: number,
    y: number,
    key: string,
    ammo: number,
    cooldown: number,
    bulletType: BulletType,
    gunType: string
  ) {
    super(scene, x, y, key)
    scene.add.existing(this)
    this.ammo = this.maxAmmo = ammo
    this.cooldown = cooldown
    this.bulletType = bulletType
    this.gunType = gunType
    this.setOrigin(0.5)
    this.gameScene = scene
  }

  public rotateToPointer(pointer: Phaser.Input.Pointer) {
    const angle = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      pointer.worldX,
      pointer.worldY
    )
    this.setRotation(angle)
  }

  protected createBullet(
    shooter: Player | Enemy,
    angle: number
  ): Phaser.Physics.Arcade.Sprite {
    const worldPos = this.getWorldTransformMatrix().transformPoint(0, 0)

    const bullet = this.gameScene.playerBullets.create(
      worldPos.x,
      worldPos.y,
      this.bulletType.sprite
    ) as Phaser.Physics.Arcade.Sprite

    bullet.setRotation(angle)
    if (this.bulletType.scale) bullet.setScale(this.bulletType.scale)

    this.scene.physics.velocityFromRotation(
      angle,
      this.bulletType.speed,
      bullet!.body!.velocity
    )
    ;(bullet as any).damage = this.bulletType.damage

    this.scene.time.delayedCall(3000, () => {
      if (bullet && bullet.active) bullet.destroy()
    })

    // Setting collision with enemies

    if ((shooter as any).shooterType === "player") {
      this.gameScene.enemies.forEach((enemy) => {
        this.scene.physics.add.overlap(
          this.gameScene.playerBullets,
          enemy,
          enemy.handleBulletHitEnemy,
          undefined,
          enemy
        )
      })
    } else if ((shooter as any).shooterType === "enemy") {
      this.scene.physics.add.overlap(
        bullet,
        this.gameScene.player,
        (obj1, obj2) => {
          const bullet = obj1 as Phaser.Physics.Arcade.Sprite
          const player = obj2 as Player

          console.log(obj1, obj2)

          player.takeDamage((bullet as any).damage || 10)
          bullet.destroy()
        },
        undefined,
        this.scene
      )
    }

    return bullet
  }

  public abstract tryShoot(
    shooter: Player | Enemy,
    pointer: Phaser.Input.Pointer
  ): boolean
  public abstract update(): void

  public addAmmo(amount: number): void {
    this.ammo = Math.min(this.ammo + amount, this.maxAmmo)
  }

  public canShoot(): boolean {
    return this.ammo > 0 && this.scene.time.now - this.lastShot >= this.cooldown
  }
}
