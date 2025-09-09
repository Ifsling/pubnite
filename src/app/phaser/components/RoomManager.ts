import GameScene from "../scenes/GameScene"

export default class RoomManager {
  scene: GameScene

  // ---- easy tweaks ----
  private static readonly ROOM_VIEW_PCT = 0.9 // viewport width % of screen
  private static readonly ROOM_MAX_HEIGHT_PCT = 0.95 // max viewport height % of screen
  private static readonly PLAYER_SCALE = 0.3 // player visual scale in room
  private static readonly ROOM_ZOOM_MULT = 2.4 // >1 to make room appear larger than viewport
  private static readonly ROOM_ZOOM_MAX = 4 // safety cap
  private static readonly OVERLAY_ALPHA = 0.5 // black overlay opacity
  private static readonly OVERLAY_PAD_MULT = 1.2 // extra padding beyond visible world size

  private map?: Phaser.Tilemaps.Tilemap
  private bgLayer?: Phaser.Tilemaps.TilemapLayer
  private wallsLayer?: Phaser.Tilemaps.TilemapLayer
  private roomLayer?: Phaser.GameObjects.Layer
  private roomOverlay?: Phaser.GameObjects.Rectangle
  private roomCam?: Phaser.Cameras.Scene2D.Camera
  private roomColliders: Phaser.Physics.Arcade.Collider[] = []
  private dummyPlayer?: Phaser.GameObjects.Sprite

  constructor(scene: GameScene) {
    this.scene = scene
  }

  enterRoom(
    roomKey: string,
    spawnPoint: Phaser.Math.Vector2,
    entryPoint: Phaser.Math.Vector2
  ) {
    // 1) Decoy outside
    this.dummyPlayer = this.scene.add.sprite(
      entryPoint.x,
      entryPoint.y,
      "player"
    )
    this.scene.physics.world.enable(this.dummyPlayer)

    // 2) World-space tilemap
    this.map = this.scene.make.tilemap({ key: roomKey })
    const tilesetName = this.map.tilesets[0]?.name || "rooms_tileset"
    const tileset = this.map.addTilesetImage(tilesetName, "rooms_tileset")
    if (!tileset) throw new Error("Failed to load tileset")

    this.bgLayer = this.map.createLayer("Background", tileset, 0, 0)!
    this.wallsLayer = this.map.createLayer("Walls", tileset, 0, 0)!
    if (this.wallsLayer) this.wallsLayer.setCollisionBetween(0, 3) // don't remove
    this.wallsLayer.setCollisionByProperty({ collides: true })

    // 3) Render-only grouping (physics unaffected)
    this.roomLayer = this.scene.add.layer()

    // Depth order we want: overlay(0) < bg(10) < player(20) < walls(30)
    this.bgLayer.setDepth(10)
    this.scene.player.setDepth(20)
    this.wallsLayer.setDepth(30)

    // Add tile layers first; overlay will be added *before* bg to keep it under
    this.roomLayer.add([this.bgLayer, this.wallsLayer])

    // 4) Move player into room (rendering only)
    this.scene.player.setPosition(spawnPoint.x, spawnPoint.y)
    this.scene.player.setScale(RoomManager.PLAYER_SCALE)
    this.roomLayer.add(this.scene.player)
    if ((this.scene.player as any).setSpeed) {
      ;(this.scene.player as any).setSpeed(250)
    }

    // 5) Disable outside-world colliders while inside
    if (this.scene.outsideColliders) {
      this.scene.outsideColliders.forEach(
        (c: Phaser.Physics.Arcade.Collider) => (c.active = false)
      )
    }

    // 6) Collide player with room walls
    this.roomColliders.push(
      this.scene.physics.add.collider(this.scene.player, this.wallsLayer)
    )

    // 7) ROOM CAMERA: centered viewport; zoom IN so room > viewport
    const sw = this.scene.scale.width
    const sh = this.scene.scale.height
    const mapW = this.map.widthInPixels
    const mapH = this.map.heightInPixels
    const mapAspect = mapW / mapH

    let viewW = Math.round(sw * RoomManager.ROOM_VIEW_PCT)
    let viewH = Math.round(viewW / mapAspect)
    const maxH = Math.floor(sh * RoomManager.ROOM_MAX_HEIGHT_PCT)
    if (viewH > maxH) {
      viewH = maxH
      viewW = Math.round(viewH * mapAspect)
    }
    const vx = Math.round((sw - viewW) / 2)
    const vy = Math.round((sh - viewH) / 2)

    this.roomCam = this.scene.cameras.add(vx, vy, viewW, viewH)

    // Base zoom that just covers the viewport with the map; then zoom in more
    const baseCoverZoom = Math.max(viewW / mapW, viewH / mapH)
    const zoom = Phaser.Math.Clamp(
      baseCoverZoom * RoomManager.ROOM_ZOOM_MULT,
      0.1,
      RoomManager.ROOM_ZOOM_MAX
    )
    this.roomCam.setZoom(zoom).setBounds(0, 0, mapW, mapH)
    this.roomCam.startFollow(this.scene.player, true, 0.15, 0.15)

    // 8) Create a BIG world-space black overlay under the bg (not cropped)
    // Compute the visible world size for this camera -> pad beyond it so edges are always black
    const visWorldW = viewW / zoom
    const visWorldH = viewH / zoom
    const padW = visWorldW * RoomManager.OVERLAY_PAD_MULT
    const padH = visWorldH * RoomManager.OVERLAY_PAD_MULT
    const overlayW = mapW + padW * 2
    const overlayH = mapH + padH * 2

    // center overlay on the map center
    const cx = mapW / 2
    const cy = mapH / 2

    this.roomOverlay = this.scene.add
      .rectangle(
        cx,
        cy,
        overlayW,
        overlayH,
        0x000000,
        RoomManager.OVERLAY_ALPHA
      )
      .setDepth(0) // BELOW background
    // IMPORTANT: insert overlay at the bottom of the roomLayer stack
    this.roomLayer.addAt(this.roomOverlay, 0)

    // 9) Camera visibility: ignore lists (type-safe)
    const allChildren = this.scene.children
      .list as Phaser.GameObjects.GameObject[]

    // Room camera renders ONLY roomLayer (overlay + bg + player + walls)
    const roomLayerGO = this
      .roomLayer as unknown as Phaser.GameObjects.GameObject
    const ignoreForRoom: Phaser.GameObjects.GameObject[] = []
    for (const go of allChildren) {
      if (go !== roomLayerGO) ignoreForRoom.push(go)
    }
    this.roomCam.ignore(ignoreForRoom)

    // Main camera does NOT render the room layer (prevents double render)
    const mainCam = this.scene.cameras.main
    mainCam.stopFollow()
    mainCam.ignore(roomLayerGO)
  }

  exitRoom(exitPoint: Phaser.Math.Vector2) {
    if ((this.scene.player as any).setSpeed) {
      ;(this.scene.player as any).setSpeed(-1)
    }

    // Colliders off
    this.roomColliders.forEach((c) => c.destroy())
    this.roomColliders = []

    // Remove camera
    if (this.roomCam) {
      this.scene.cameras.remove(this.roomCam, true)
      this.roomCam = undefined
    }

    // Destroy visuals
    if (this.roomOverlay) {
      this.roomOverlay.destroy()
      this.roomOverlay = undefined
    }
    if (this.bgLayer) {
      this.bgLayer.destroy()
      this.bgLayer = undefined
    }
    if (this.wallsLayer) {
      this.wallsLayer.destroy()
      this.wallsLayer = undefined
    }
    if (this.map) {
      this.map.destroy()
      this.map = undefined
    }

    if (this.dummyPlayer) {
      this.dummyPlayer.destroy()
      this.dummyPlayer = undefined
    }

    // Re-enable outside collisions
    if (this.scene.outsideColliders) {
      this.scene.outsideColliders.forEach(
        (c: Phaser.Physics.Arcade.Collider) => (c.active = true)
      )
    }

    // Restore main camera follow
    const mainCam = this.scene.cameras.main
    mainCam.startFollow(this.scene.player, true, 0.15, 0.15)

    // Remove render layer
    if (this.roomLayer) {
      this.roomLayer.remove(this.scene.player)
      this.roomLayer.destroy()
      this.roomLayer = undefined
    }

    // Reset player
    this.scene.player.setDepth(0)
    this.scene.player.setPosition(exitPoint.x, exitPoint.y)
  }
}
