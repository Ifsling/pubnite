// src/components/guns/Ak47.ts
import Gun, { BulletType } from "./Gun"

const AK47_BULLET: BulletType = {
  sprite: "bullet",
  damage: 30,
  speed: 600
}

export default class Ak47 extends Gun {
  private firing = false

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "ak47", 60, 100, AK47_BULLET, "ak47")
  }

  public startFiring() {
    this.firing = true
  }

  public stopFiring() {
    this.firing = false
  }

  public tryShoot(pointer: Phaser.Input.Pointer): boolean {
    if (!this.firing || !this.canShoot()) return false
    
    this.lastShot = this.scene.time.now
    this.ammo--
    this.createBullet(this.rotation)
    return true
  }

  public update(): void {
    // Continuous firing handled in tryShoot
  }
}