// src/components/guns/Sniper.ts
import GameScene from "../../scenes/GameScene"
import Enemy from "../Enemy"
import Player from "../Player"
import Gun, { BulletType } from "./Gun"

const SNIPER_BULLET: BulletType = {
  sprite: "sniper-bullet",
  damage: 100,
  speed: 1000,
  scale: 1.5,
}

export default class Sniper extends Gun {
  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "sniper", 5, 2000, SNIPER_BULLET, "sniper")
  }

  public tryShoot(
    shooter: Player | Enemy,
    pointer: Phaser.Input.Pointer
  ): boolean {
    if (!this.canShoot()) return false

    this.lastShot = this.scene.time.now
    this.ammo--
    this.createBullet(shooter, this.rotation)
    return true
  }

  public update(): void {
    // Sniper doesn't need continuous updates
  }
}
