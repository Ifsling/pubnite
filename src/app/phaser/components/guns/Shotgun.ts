import Gun, { BulletType } from "./Gun"

const SHOTGUN_BULLET: BulletType = {
  sprite: "bullet",
  damage: 20,
  speed: 700
}

const SPREAD = 0.2

export default class Shotgun extends Gun {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "shotgun", 10, 1000, SHOTGUN_BULLET, "shotgun")
  }

  public tryShoot(pointer: Phaser.Input.Pointer): boolean {
    if (!this.canShoot() || this.ammo < 3) return false
    
    this.lastShot = this.scene.time.now
    this.ammo -= 3
    
    // Fire 3 bullets with spread
    for (const offset of [-SPREAD, 0, SPREAD]) {
      this.createBullet(this.rotation + offset)
    }
    return true
  }

  public update(): void {
    // Shotgun doesn't need continuous updates
  }
}