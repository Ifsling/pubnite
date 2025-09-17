import * as Phaser from "phaser"
import GameScene from "../../scenes/GameScene"
import type Enemy from "../Enemy"
import type Player from "../Player"

export interface BulletType {
  sprite: string
  damage: number
  speed: number
  scale?: number
}

export const GUN_RELOAD_TIME = {
  pistol: 2000,
  ak47: 3000,
  shotgun: 4000,
  sniper: 5000,
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
    // pick the right group
    const isPlayer = (shooter as any).shooterType === "player"
    const group = isPlayer
      ? this.gameScene.playerBullets
      : this.gameScene.enemyBullets

    // spawn at gun's world position
    const worldPos = this.getWorldTransformMatrix().transformPoint(0, 0)
    const bullet = group.create(
      worldPos.x,
      worldPos.y,
      this.bulletType.sprite
    ) as Phaser.Physics.Arcade.Sprite

    bullet.setRotation(angle)
    if (this.bulletType.scale) bullet.setScale(this.bulletType.scale)

    this.scene.physics.velocityFromRotation(
      angle,
      this.bulletType.speed,
      bullet.body!.velocity
    )

    // tag bullet
    ;(bullet as any).damage = this.bulletType.damage
    ;(bullet as any).shooter = shooter

    if (this.gameScene.roomManager?.isInsideRoom()) {
      this.gameScene.roomManager.attachToRoom(bullet)
      bullet.setDepth(35) // above walls (walls are depth 30)
    }

    // auto-despawn
    this.scene.time.delayedCall(9000, () => {
      if (bullet && bullet.active) bullet.destroy()
    })

    // --- Collisions / damage ---
    if (isPlayer) {
      // Player bullet -> damage every enemy
      this.gameScene.enemies.forEach((enemy) => {
        this.scene.physics.add.overlap(
          bullet,
          enemy,
          (_b, e) => {
            const dmg = (bullet as any).damage || 10
            ;(e as any).takeDamage(dmg)
            bullet.destroy()
          },
          undefined,
          this.scene
        )
      })
    } else {
      // Enemy bullet -> damage PLAYER
      this.scene.physics.add.overlap(
        bullet,
        this.gameScene.player,
        (b, p) => {
          const dmg = (b as any).damage || 10
          ;(p as any).takeDamage(dmg)
          ;(b as Phaser.Physics.Arcade.Sprite).destroy()
        },
        undefined,
        this.scene
      )

      // Enemy bullet -> damage OTHER ENEMIES (no self-hit)
      const shooterEnemy = shooter as Enemy
      this.gameScene.enemies.forEach((enemy) => {
        if (enemy === shooterEnemy) return
        this.scene.physics.add.overlap(
          bullet,
          enemy,
          (b, e) => {
            const dmg = (b as any).damage || 10
            ;(e as any).takeDamage(dmg)
            ;(b as Phaser.Physics.Arcade.Sprite).destroy()
          },
          undefined,
          this.scene
        )
      })
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
