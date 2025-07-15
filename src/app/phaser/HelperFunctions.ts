import GameScene from "./scenes/GameScene"

export function AddPhysicsItem(
  scene: GameScene,
  itemCode: string,
  x: number,
  y: number,
  isCollectable: boolean = false,
  isCollidable: boolean = true,
  isImmovable: boolean = true,
  pickupType: string | null = null
) {
  const item = scene.add.sprite(x, y, itemCode).setOrigin(0.5, 0.5)
  scene.physics.add.existing(item)
  const body = item.body as Phaser.Physics.Arcade.Body

  // Set pickup type
  if (isCollectable) {
    item.setData("pickupType", pickupType || itemCode)
    ;(item as any).pickupType = pickupType || itemCode
  }

  if (isCollidable && !isCollectable) {
    scene.physics.add.collider(scene.player, item)
    body.setImmovable(isImmovable)
  } else {
    body.setImmovable(true)
    scene.physics.add.overlap(scene.player, item, () => {
      scene.player.tryPickup(item)
    })
  }

  return item
}

export function showTopLeftOverlayText(
  scene: Phaser.Scene,
  message: string,
  x: number = 20,
  y: number = 70,
  destroyAfter: number = -1,
  textColor: number = 0xffffff,
  bgColor: number = 0x000000,
  bgAlpha: number = 0.6,
  padding: number = 10
): {
  container: Phaser.GameObjects.Container
  updateMessage: (newMsg: string) => void
} {
  // Create text
  const text = scene.add.text(0, 0, message, {
    fontSize: "24px",
    color: `#${textColor.toString(16).padStart(6, "0")}`,
    fontFamily: "Arial",
    fontStyle: "bold",
    align: "left",
    stroke: "#000000",
    strokeThickness: 3,
    wordWrap: { width: scene.scale.width / 2 },
  })
  text.setScrollFactor(0)

  // Compute background size
  const bgWidth = text.width + padding * 2
  const bgHeight = text.height + padding * 2

  // Create background
  const background = scene.add.rectangle(
    0,
    0,
    bgWidth,
    bgHeight,
    bgColor,
    bgAlpha
  )
  background.setOrigin(0)
  background.setScrollFactor(0)

  // Position text inside the background
  text.setPosition(padding, padding)

  // Create container to hold both
  const container = scene.add.container(x, y, [background, text])
  container.setScrollFactor(0)
  container.setDepth(10000)

  // Method to update the message and resize the background
  const updateMessage = (newMsg: string) => {
    text.setText(newMsg)
    background.setSize(text.width + padding * 2, text.height + padding * 2)
  }

  // Destroy after a delay
  if (destroyAfter !== -1) {
    scene.time.delayedCall(destroyAfter, () => {
      container.destroy()
    })
  }

  return { container, updateMessage }
}
