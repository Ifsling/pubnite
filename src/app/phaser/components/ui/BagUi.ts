import * as Phaser from "phaser"
import { HEALERS_HEAL_AMOUNT } from "../../Constants"
import GameScene from "../../scenes/GameScene"
import type Player from "../Player"
import LoadingHUD from "./LoadingHud"

export default class BagUI {
  private scene: GameScene
  private container: Phaser.GameObjects.Container
  private player: Player
  private isVisible: boolean = false
  private toggleKey: Phaser.Input.Keyboard.Key

  constructor(scene: GameScene, player: Player) {
    this.scene = scene
    this.player = player

    this.toggleKey = scene!.input!.keyboard!.addKey("B")
    this.container = scene.add
      .container(scene.scale.width - 400, 0) // position it 400px from right
      .setScrollFactor(0)
      .setVisible(false)
      .setDepth(1000)

    this.createUI()
  }

  private createUI() {
    const bg = this.scene.add
      .rectangle(0, 0, 400, this.scene.scale.height, 0x222222, 0.95)
      .setOrigin(0, 0)
      .setScrollFactor(0)

    const title = this.scene.add.text(10, 10, "Bag Items", {
      fontSize: "20px",
      color: "#ffffff",
    })

    const close = this.scene.add
      .text(390, 10, "X", {
        // 390 because container width is 400
        fontSize: "20px",
        color: "#ff5555",
      })
      .setOrigin(1, 0)
      .setInteractive()
      .on("pointerdown", () => this.toggle())
      .setScrollFactor(0)

    this.container.add([bg, title, close])
  }

  public update() {
    if (Phaser.Input.Keyboard.JustDown(this.toggleKey)) {
      this.toggle()
    }
  }

  public toggle() {
    this.isVisible = !this.isVisible
    this.container.setVisible(this.isVisible)

    if (this.isVisible) {
      this.populateItems()
    }
  }

  public populateItems() {
    // Remove old items (keep first 3: bg, title, close)
    this.container
      .getAll()
      .slice(3)
      .forEach((child) => child.destroy())

    const items = this.player.getBagItems()
    items.forEach((key, index) => {
      const y = 50 + index * 60

      const icon = this.scene.add
        .sprite(10, y, key)
        .setScale(0.5)
        .setOrigin(0, 0.5)

      const name = this.scene.add.text(60, y - 10, key, {
        fontSize: "14px",
        color: "#ffffff",
      })

      const containerWidth = 400

      const throwBtn = this.scene.add
        .text(containerWidth - 10, y - 10, "THROW", {
          fontSize: "14px",
          color: "#ffffff",
          backgroundColor: "#aa0000",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(1, 0) // anchor to top-right
        .setInteractive()
        .setScrollFactor(0)
        .on("pointerdown", () => {
          this.player.removeItemFromBag(key)
          this.populateItems()
        })

      const useBtn = this.scene.add
        .text(containerWidth - 80, y - 10, "USE", {
          fontSize: "14px",
          color: "#ffffff",
          backgroundColor: "#00aa00",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(1, 0)
        .setInteractive()
        .setScrollFactor(0)
        .on(
          "pointerdown",
          (
            pointer: Phaser.Input.Pointer,
            _lx: number,
            _ly: number,
            event?: any
          ) => {
            // prevent this click from reaching scene-level pointer handlers
            event?.stopPropagation?.()
            ;(pointer as any)?.event?.stopPropagation?.()

            this.useItem(key)
          }
        )

      this.container.add([icon, name, useBtn, throwBtn])
    })
  }

  healOverTime(total: number, durationMs: number, steps: number) {
    // Split total into 'steps' pieces; make sure rounding errors don't lose/gain HP.
    const base = Math.floor((total / steps) * 1000) / 1000 // keep decimals stable
    const remainder = total - base * steps
    const delay = durationMs / steps
    let tick = 0

    this.scene.time.addEvent({
      delay,
      repeat: steps - 1, // fires 'steps' times total
      callback: () => {
        // last tick gets the remainder so sum == total
        const amt = ++tick === steps ? base + remainder : base
        this.player.addHealth(amt)
      },
    })
  }

  useItem(key: string) {
    switch (key) {
      case "ouchwrap":
        LoadingHUD.get(this.scene).show("Using Ouchwrap", 3500)
        this.scene.time.delayedCall(3500, () => {
          this.player.addHealth(HEALERS_HEAL_AMOUNT.ouchwrap)
        })
        break
      case "healbox":
        LoadingHUD.get(this.scene).show("Using Healbox", 9000)
        // heal after 5 seconds
        this.scene.time.delayedCall(9000, () => {
          this.player.addHealth(HEALERS_HEAL_AMOUNT.healbox)
        })
        break
      case "slowmo-injection":
        const dur = 30000
        const totalHeal = 50
        const steps = 30

        LoadingHUD.get(this.scene).show("Injecting SlowMo…", dur)
        this.healOverTime(totalHeal, dur, steps)
        break

      case "boomnut":
        // Enter grenade-aim mode and close bag immediately
        this.player.startGrenadeAim()
        this.isVisible = false
        this.container.setVisible(false)
        break
    }

    this.player.removeItemFromBag(key)
    if (this.isVisible) this.populateItems()
  }
}
