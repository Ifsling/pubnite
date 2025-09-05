import Enemy from "./Enemy"

export default class DeathOverlay {
  private scene: Phaser.Scene
  private overlay!: Phaser.GameObjects.Rectangle
  private loserText!: Phaser.GameObjects.Text
  private playerCountText!: Phaser.GameObjects.Text
  private lobbyButton!: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, enemies: Enemy[]) {
    this.scene = scene

    // Destroy any existing overlays before creating a new one
    this.scene.children.list
      .filter(
        (obj) => (obj as any).isDeathOverlayElement // mark overlay elements
      )
      .forEach((obj) => obj.destroy())

    // Transparent black background
    this.overlay = this.scene.add
      .rectangle(
        0,
        0,
        this.scene.cameras.main.width,
        this.scene.cameras.main.height,
        0x000000,
        0.8
      )
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(999)
    ;(this.overlay as any).isDeathOverlayElement = true

    this.loserText = this.scene.add.text(80, 80, "Loser Loser Veggie Dinner", {
      fontFamily: "BRF",
      fontSize: "64px",
      color: "#ffffff",
      fontStyle: "bold",
    })
    this.loserText.setScrollFactor(0).setDepth(1000)
    ;(this.loserText as any).isDeathOverlayElement = true

    // Top-right players remaining
    const aliveEnemies = enemies.filter((e) => e.active).length
    const totalAlive = 1 + aliveEnemies
    this.playerCountText = this.scene.add.text(
      this.scene.cameras.main.width - 300,
      80,
      `#${aliveEnemies}/${totalAlive}`,
      {
        fontFamily: "BRF",
        fontSize: "40px",
        color: "#ff4444",
      }
    )
    this.playerCountText.setScrollFactor(0).setDepth(1000)
    ;(this.playerCountText as any).isDeathOverlayElement = true

    // Bottom-middle button
    this.lobbyButton = this.scene.add
      .text(
        this.scene.cameras.main.width / 2,
        this.scene.cameras.main.height - 100,
        "Go to Lobby",
        {
          fontSize: "36px",
          backgroundColor: "#ffffff",
          color: "#000000",
          padding: { x: 20, y: 10 },
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive()
      .setDepth(1000)
    ;(this.lobbyButton as any).isDeathOverlayElement = true

    this.lobbyButton.on("pointerover", () => {
      this.lobbyButton.setStyle({ backgroundColor: "#dddddd" })
    })
    this.lobbyButton.on("pointerout", () => {
      this.lobbyButton.setStyle({ backgroundColor: "#ffffff" })
    })
    this.lobbyButton.on("pointerdown", () => {
      this.scene.scene.restart()
    })
  }
}
