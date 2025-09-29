import * as Phaser from "phaser"

export default class LoadingHUD {
  // ---- Singleton per scene ----
  private static instances = new WeakMap<Phaser.Scene, LoadingHUD>()
  static get(scene: Phaser.Scene) {
    let hud = LoadingHUD.instances.get(scene)
    if (!hud) {
      hud = new LoadingHUD(scene)
      LoadingHUD.instances.set(scene, hud)
    }
    return hud
  }

  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private ring: Phaser.GameObjects.Graphics
  private label: Phaser.GameObjects.Text
  private panel: Phaser.GameObjects.Rectangle

  private radius = 16
  private stroke = 4
  private margin = 12
  private padX = 10
  private padY = 8

  private showing = false
  private startTime = 0
  private duration = 0
  private updater?: () => void

  private constructor(scene: Phaser.Scene) {
    this.scene = scene

    // Background panel (subtle)
    this.panel = scene.add
      .rectangle(0, 0, 10, 10, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setScrollFactor(0)

    // Circular progress (drawn each frame)
    this.ring = scene.add.graphics().setScrollFactor(0)

    // Label
    this.label = scene.add
      .text(0, 0, "", { fontSize: "14px", color: "#ffffff" })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)

    this.root = scene.add
      .container(0, 0, [this.panel, this.ring, this.label])
      .setScrollFactor(0)
      .setDepth(10_000)
      .setVisible(false)

    // Keep pinned to bottom-left on resize
    scene.scale.on("resize", this.layout, this)
    this.layout()
  }

  // Public API
  show(text: string, durationMs: number) {
    if (durationMs <= 0) durationMs = 1
    this.showing = true
    this.startTime = this.scene.time.now
    this.duration = durationMs

    this.label.setText(text)

    // Layout sizes based on text
    const ringSize = this.radius * 2 + this.stroke
    const width = this.padX * 2 + ringSize + 8 + Math.ceil(this.label.width)
    const height = Math.max(
      this.padY * 2 + Math.ceil(this.label.height),
      this.padY * 2 + ringSize
    )
    this.panel.setSize(width, height)

    // Position children inside the panel
    const x0 = this.margin
    const y0 = this.scene.scale.height - height - this.margin

    this.root.setPosition(x0, y0)
    const ringX = this.padX + this.radius + this.stroke * 0.5
    const ringY = height / 2
    this.label.setPosition(this.padX + ringSize + 8, height / 2)

    // Ensure visible
    this.root.setVisible(true)

    // Hook update
    if (!this.updater) {
      this.updater = this.updateProgress
      this.scene.events.on("update", this.updater, this)
    }

    // Auto-hide after duration
    this.scene.time.delayedCall(durationMs, () => {
      if (!this.showing) return
      this.hide()
    })
  }

  hide() {
    if (!this.showing) return
    this.showing = false
    this.root.setVisible(false)
    this.ring.clear()

    if (this.updater) {
      this.scene.events.off("update", this.updater, this)
      this.updater = undefined
    }
  }

  isShowing() {
    return this.showing
  }

  // Draw progress each frame
  private updateProgress() {
    if (!this.showing) return
    const now = this.scene.time.now
    const t = Phaser.Math.Clamp((now - this.startTime) / this.duration, 0, 1)

    // Clear and redraw
    this.ring.clear()

    // Background circle (track)
    const cx = this.panel.x + this.padX + this.radius + this.stroke * 0.5
    const cy = this.panel.y + this.panel.height / 2
    this.ring.lineStyle(this.stroke, 0x444444, 1)
    this.ring.beginPath()
    this.ring.arc(cx, cy, this.radius, 0, Phaser.Math.PI2)
    this.ring.strokePath()

    // Progress arc
    this.ring.lineStyle(this.stroke, 0xffffff, 1)
    this.ring.beginPath()
    this.ring.arc(
      cx,
      cy,
      this.radius,
      -Math.PI / 2,
      -Math.PI / 2 + t * Phaser.Math.PI2,
      false
    )
    this.ring.strokePath()
  }

  private layout() {
    // Keep docked at bottom-left with current size
    const height = this.panel.height
    this.root.setPosition(
      this.margin,
      this.scene.scale.height - height - this.margin
    )
  }

  // Optional: destroy if you change scenes frequently
  destroy() {
    this.hide()
    this.scene.scale.off("resize", this.layout, this)
    this.root.destroy()
  }
}
