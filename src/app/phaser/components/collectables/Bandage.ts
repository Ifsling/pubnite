// Bandage.ts
import GameScene from "../../scenes/GameScene"
import Player from "../Player"

export default class Bandage {
  private static readonly APPLY_DURATION = 2000 // ms to use bandage
  private static readonly HEAL_AMOUNT = 25 // heals 25% of max HP

  private scene: GameScene
  private player: Player
  private progressBar?: Phaser.GameObjects.Graphics
  private isApplying = false
  private timerEvent?: Phaser.Time.TimerEvent

  constructor(scene: GameScene, player: Player) {
    this.scene = scene
    this.player = player
  }

  use() {
    if (this.isApplying) return
    this.isApplying = true

    // Create progress bar UI
    this.progressBar = this.scene.add.graphics()
    const barWidth = 200
    const barHeight = 15
    const barX = this.scene.scale.width / 2 - barWidth / 2
    const barY = this.scene.scale.height - 40

    let elapsed = 0
    this.timerEvent = this.scene.time.addEvent({
      delay: 50,
      repeat: Bandage.APPLY_DURATION / 50,
      callback: () => {
        elapsed += 50
        const progress = Phaser.Math.Clamp(
          elapsed / Bandage.APPLY_DURATION,
          0,
          1
        )

        this.progressBar!.clear()
        this.progressBar!.fillStyle(0x000000, 0.6)
        this.progressBar!.fillRect(
          barX - 2,
          barY - 2,
          barWidth + 4,
          barHeight + 4
        )
        this.progressBar!.fillStyle(0xffffff, 1)
        this.progressBar!.fillRect(barX, barY, barWidth, barHeight)
        this.progressBar!.fillStyle(0x00ff00, 1)
        this.progressBar!.fillRect(barX, barY, barWidth * progress, barHeight)

        if (progress >= 1) {
          this.applyHeal()
        }
      },
    })
  }

  private applyHeal() {
    this.player.addHealth(Bandage.HEAL_AMOUNT)

    this.cleanup()
  }

  cancel() {
    this.cleanup()
  }

  private cleanup() {
    this.isApplying = false
    if (this.progressBar) {
      this.progressBar.destroy()
      this.progressBar = undefined
    }
    if (this.timerEvent) {
      this.timerEvent.destroy()
      this.timerEvent = undefined
    }
  }
}
