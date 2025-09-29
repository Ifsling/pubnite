import GameScene from "../../scenes/GameScene"

export class HouseEntryPoint {
  scene: GameScene
  container: Phaser.GameObjects.Container
  glow: Phaser.GameObjects.Graphics
  ring: Phaser.GameObjects.Graphics
  physicsBody: Phaser.Physics.Arcade.Sprite
  radius: number = 50
  callback: () => void

  constructor(scene: GameScene, x: number, y: number, callback: () => void) {
    this.scene = scene
    this.callback = callback

    // --- Visuals ---
    this.glow = this.createGlowingCircle(scene, 0, 0, this.radius, 0x00ffff)
    this.ring = this.createRotatingRing(scene, 0, 0, this.radius, 0x00ffff)

    this.container = scene.add.container(x, y, [this.glow, this.ring])

    // --- Physics body (invisible) ---
    this.physicsBody = scene.physics.add.sprite(x, y, undefined as any)
    ;(this.physicsBody.body as Phaser.Physics.Arcade.Body)
      .setCircle(this.radius, -this.radius + 18, -this.radius + 18)
      .setImmovable(true)
      .setAllowGravity(false)

    // --- Sync visuals to physics body ---
    scene.events.on("update", () => {
      this.container.x = this.physicsBody.x
      this.container.y = this.physicsBody.y
    })

    // --- Animations ---
    scene.tweens.add({
      targets: this.glow,
      scale: { from: 0.9, to: 1.2 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    })

    scene.tweens.add({
      targets: this.ring,
      angle: 360,
      duration: 4000,
      repeat: -1,
      ease: "Linear",
    })

    // --- Overlap detection (always use physics body!) ---
    scene.physics.add.overlap(
      scene.player, // your player object
      this.physicsBody, // NEVER pass a container
      this.handleOverlap,
      undefined,
      this
    )
  }

  createGlowingCircle(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    color: number
  ) {
    const glow = scene.add.graphics({ x, y })
    for (let i = 0; i < 5; i++) {
      glow.fillStyle(color, 0.08 * (6 - i))
      glow.fillCircle(0, 0, radius + i * 8)
    }
    return glow
  }

  createRotatingRing(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    color: number
  ) {
    const ring = scene.add.graphics({ x, y })
    ring.lineStyle(6, color, 1)
    ring.strokeCircle(0, 0, radius)
    return ring
  }

  handleOverlap() {
    this.callback()
  }

  destroy() {
    this.container.destroy()
    this.glow.destroy()
    this.ring.destroy()
    this.physicsBody.destroy()
  }
}
