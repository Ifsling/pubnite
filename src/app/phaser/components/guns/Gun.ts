import Phaser from "phaser"

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

  constructor(
    scene: Phaser.Scene,
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

  protected createBullet(angle: number): Phaser.Physics.Arcade.Sprite {
    // Get gun's global position (world coords) instead of local (container) coords
    const worldPos = this.getWorldTransformMatrix().transformPoint(0, 0)

    const bullet = this.scene.physics.add.sprite(
      worldPos.x,
      worldPos.y,
      this.bulletType.sprite
    )

    bullet.setRotation(angle)
    if (this.bulletType.scale) {
      bullet.setScale(this.bulletType.scale)
    }
    this.scene.physics.velocityFromRotation(
      angle,
      this.bulletType.speed,
      bullet.body.velocity
    )

    // Auto-destroy bullets after 3 seconds
    this.scene.time.delayedCall(3000, () => {
      if (bullet && bullet.active) {
        bullet.destroy()
      }
    })

    return bullet
  }

  public abstract tryShoot(pointer: Phaser.Input.Pointer): boolean
  public abstract update(): void

  public addAmmo(amount: number): void {
    this.ammo = Math.min(this.ammo + amount, this.maxAmmo)
  }

  public canShoot(): boolean {
    return this.ammo > 0 && this.scene.time.now - this.lastShot >= this.cooldown
  }
}
