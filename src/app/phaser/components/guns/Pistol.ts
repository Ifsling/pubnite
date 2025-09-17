import GameScene from "../../scenes/GameScene"
import Enemy from "../Enemy"
import Player from "../Player"
import Gun, { BulletType } from "./Gun"

const PISTOL_BULLET: BulletType = {
  sprite: "pistol-bullet",
  damage: 25,
  speed: 500,
}

export default class Pistol extends Gun {
  constructor(scene: GameScene, x: number, y: number) {
    super(scene, x, y, "pistol", 15, 500, PISTOL_BULLET, "pistol")
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
    // Pistol doesn't need continuous updates
  }
}
