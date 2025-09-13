// src/components/weapons/Grenade.ts
import Phaser from "phaser"
import type GameScene from "../scenes/GameScene"
import type Enemy from "./Enemy"
import type Player from "./Player"

type GrenadeConfig = {
  fuseMs?: number
  radius?: number
  maxDamage?: number
  minDamage?: number
}

export default class Grenade extends Phaser.Physics.Arcade.Sprite {
  private sceneRef: GameScene
  private readonly fuseMs: number
  private readonly radius: number
  private readonly maxDamage: number
  private readonly minDamage: number
  private exploded = false

  constructor(
    scene: GameScene,
    x: number,
    y: number,
    velocity: Phaser.Math.Vector2,
    config: GrenadeConfig = {}
  ) {
    // hard-bind to the exact texture key you want
    super(scene, x, y, "boomnut-no-glow")

    this.sceneRef = scene
    this.fuseMs = config.fuseMs ?? 900
    this.radius = config.radius ?? 500
    this.maxDamage = config.maxDamage ?? 95
    this.minDamage = config.minDamage ?? 30

    // Ensure the texture is actually loaded; if not, log clearly.
    if (!scene.textures.exists("boomnut-no-glow")) {
      console.warn(
        "[Grenade] Texture 'boomnut-no-glow' not loaded. " +
          "Make sure it's preloaded, e.g.: this.load.image('boomnut-no-glow', '.../boomnut-no-glow.png')"
      )
    }

    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Arcade physics tuning for a nice top-down toss
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setCircle(this.width * 0.45)
    body.setBounce(0.25)
    body.setDrag(120, 120)
    body.setMaxSpeed(1500)
    body.setVelocity(velocity.x, velocity.y)
    body.setCollideWorldBounds(true)

    // Fuse + safety explode on rest
    scene.time.delayedCall(this.fuseMs, () => this.explode())
    this.sceneRef.events.on("update", this.autoExplodeOnRest, this)
  }

  private autoExplodeOnRest() {
    if (this.exploded) return
    const body = this.body as Phaser.Physics.Arcade.Body
    if (!body) return
    if (body.velocity.lengthSq() < 80 * 80) {
      this.explode()
    }
  }

  private explode() {
    if (this.exploded) return
    this.exploded = true
    this.spawnParticles()
    this.applyDamageFalloff(this.x, this.y)
    this.sceneRef.events.off("update", this.autoExplodeOnRest, this)
    this.destroy()
  }

  private spawnParticles() {
    const explosion = this.scene.add.particles(0, 0, "white-circle", {
      x: 0,
      y: 0,
      speed: { min: 150, max: 400 }, // initial burst speed
      angle: { min: 0, max: 360 },
      scale: {
        start: Phaser.Math.FloatBetween(0.5, 1.0), // some small, some big
        end: Phaser.Math.FloatBetween(1.2, 2.0),
      },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      gravityY: 0,
      quantity: 30,
      tint: [0xff0000, 0xffa500, 0xffff00], // red, orange, yellow
      blendMode: "ADD",
      emitting: false,
      emitZone: {
        type: "edge",
        source: new Phaser.Geom.Circle(0, 0, 30),
        quantity: 30,
      },
    })

    explosion.explode(30, (this.body?.x || 0) + 100, (this.body?.y || 0) + 50)

    // Clean up after the particles finish
    this.scene.time.delayedCall(700, () => explosion.destroy())
  }

  private applyDamageFalloff(cx: number, cy: number) {
    const s = this.sceneRef
    // Player
    const player = s.player as Player
    this.damageIfInRange(player, cx, cy)
    // Enemies
    for (const e of s.enemies as Enemy[]) {
      if (!e.active) continue
      this.damageIfInRange(e as any, cx, cy)
    }
  }

  private damageIfInRange(
    target: { x: number; y: number; takeDamage?: (n: number) => void },
    cx: number,
    cy: number
  ) {
    const dist = Phaser.Math.Distance.Between(cx, cy, target.x, target.y)
    if (dist > this.radius) return
    const t = Phaser.Math.Clamp(dist / this.radius, 0, 1)
    const dmg = Math.round(
      Phaser.Math.Linear(this.maxDamage, this.minDamage, t)
    )
    if (typeof target.takeDamage === "function") target.takeDamage(dmg)
  }
}
