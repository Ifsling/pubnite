// src/components/DeathOverlay.ts
import GameScene from "../../scenes/GameScene"
import Enemy from "../Enemy"

export default class DeathOverlay {
  private scene: GameScene
  private overlay: Phaser.GameObjects.Rectangle | null = null
  private resultText: Phaser.GameObjects.Text | null = null
  private playerCountText: Phaser.GameObjects.Text | null = null
  private lobbyButton: Phaser.GameObjects.Text | null = null

  constructor(
    scene: GameScene,
    enemies: Enemy[],
    isWinner: boolean,
    initialTotal: number
  ) {
    this.scene = scene

    // Destroy any existing overlays
    this.scene.children.list
      .filter((obj) => (obj as any).isDeathOverlayElement)
      .forEach((obj) => obj.destroy())

    // Transparent black background
    this.overlay = this.scene.add
      .rectangle(
        0,
        0,
        this.scene.scale.width,
        this.scene.scale.height,
        0x000000,
        0.8
      )
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(99999)
    ;(this.overlay as any).isDeathOverlayElement = true

    const message = isWinner
      ? "Winner Winner Chicken Dinner"
      : "Loser Loser Veggie Dinner"
    const color = isWinner ? "#FFD700" : "#ffffff"

    this.resultText = this.scene.add
      .text(80, 80, message, {
        fontFamily: "BRF",
        fontSize: "64px",
        color,
        fontStyle: "bold",
      })
      .setScrollFactor(0)
      .setDepth(99999)
    ;(this.resultText as any).isDeathOverlayElement = true

    const playerRank = isWinner ? 1 : 1 + enemies.filter((e) => e.active).length
    this.playerCountText = this.scene.add
      .text(0, 80, `#${playerRank}/${initialTotal}`, {
        fontFamily: "BRF",
        fontSize: "40px",
        color: "#ff4444",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(99999)
    ;(this.playerCountText as any).isDeathOverlayElement = true

    this.lobbyButton = this.scene.add
      .text(0, 0, "Go to Lobby", {
        fontSize: "36px",
        backgroundColor: "#ffffff",
        color: "#000000",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive()
      .setDepth(99999)
    ;(this.lobbyButton as any).isDeathOverlayElement = true

    this.lobbyButton.on("pointerover", () => {
      this.lobbyButton!.setStyle({ backgroundColor: "#dddddd" })
    })
    this.lobbyButton.on("pointerout", () => {
      this.lobbyButton!.setStyle({ backgroundColor: "#ffffff" })
    })
    this.lobbyButton.on("pointerdown", () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("PUBNITE_GO_TO_MENU"))
      }
      this.destroy()
      scene.totalPlayers = 0
      this.scene.scene.restart()
    })

    this.updatePosition()
    this.ensureOverlayOnTop()
    this.scene.scale.on("resize", this.updatePosition, this)

    // auto-cleanup when scene shuts down
    this.scene.events.once("shutdown", this.destroy, this)
  }

  private updatePosition() {
    if (
      !this.overlay ||
      !this.resultText ||
      !this.playerCountText ||
      !this.lobbyButton
    )
      return
    const { width, height } = this.scene.scale

    if (this.overlay.active) this.overlay.setSize(width, height)
    if (this.resultText.active) this.resultText.setPosition(80, 80)
    if (this.playerCountText.active)
      this.playerCountText.setPosition(width - 80, 80)
    if (this.lobbyButton.active)
      this.lobbyButton.setPosition(width / 2, height - 100)

    this.ensureOverlayOnTop()
  }

  /** Ensures the death overlay renders above everything else. */
  private ensureOverlayOnTop() {
    const cams = this.scene.cameras
    const w = this.scene.scale.width
    const h = this.scene.scale.height

    // Tag overlay objects
    const tag = (go: Phaser.GameObjects.GameObject | null) => {
      if (go) (go as any).__isDeathUI = true
    }
    tag(this.overlay)
    tag(this.resultText)
    tag(this.playerCountText)
    tag(this.lobbyButton)

    // Reuse or create a dedicated UI camera
    let uiCam = cams.getCamera(
      "DeathUI"
    ) as Phaser.Cameras.Scene2D.Camera | null
    if (!uiCam) {
      uiCam = cams.add(0, 0, w, h, false, "DeathUI")
    } else {
      uiCam.setSize(w, h)
    }

    // UI cam should render only overlay-tagged objects
    const toIgnoreForUICam = this.scene.children.list.filter(
      (go) => !(go as any).__isDeathUI
    )
    uiCam.ignore(toIgnoreForUICam)

    // All other cameras ignore overlay objects
    const onlyOverlay = this.scene.children.list.filter(
      (go) => (go as any).__isDeathUI
    )
    // ✅ FIX: Use the cameras array instead of a non-existent getAll()
    const allCams = (cams as any).cameras as Phaser.Cameras.Scene2D.Camera[]
    allCams.forEach((cam) => {
      if (cam !== uiCam) cam.ignore(onlyOverlay)
    })

    // Make sure UI cam renders last (top)
    cams.remove(uiCam, false)
    cams.addExisting(uiCam)
    uiCam.setScroll(0, 0)
  }

  public destroy() {
    this.scene.scale.off("resize", this.updatePosition, this)
    this.overlay?.destroy()
    this.overlay = null
    this.resultText?.destroy()
    this.resultText = null
    this.playerCountText?.destroy()
    this.playerCountText = null
    this.lobbyButton?.destroy()
    this.lobbyButton = null
  }
}
