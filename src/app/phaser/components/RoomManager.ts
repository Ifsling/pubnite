import GameScene from "../scenes/GameScene"

export default class RoomManager {
  scene: GameScene

  // ---- easy tweaks ----
  private static readonly ROOM_VIEW_PCT = 0.9 // room viewport width % of screen
  private static readonly ROOM_MAX_HEIGHT_PCT = 0.95 // cap viewport height % of screen
  private static readonly PLAYER_SCALE = 0.3 // player visual scale in room

  private map?: Phaser.Tilemaps.Tilemap
  private bgLayer?: Phaser.Tilemaps.TilemapLayer
  private wallsLayer?: Phaser.Tilemaps.TilemapLayer
  private roomLayer?: Phaser.GameObjects.Layer
  private roomOverlay?: Phaser.GameObjects.Rectangle // <-- overlay drawn by roomCam
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
    // decoy outside
    this.dummyPlayer = this.scene.add.sprite(
      entryPoint.x,
      entryPoint.y,
      "player"
    )
    this.scene.physics.world.enable(this.dummyPlayer)

    // world-space tilemap
    this.map = this.scene.make.tilemap({ key: roomKey })
    const tilesetName = this.map.tilesets[0]?.name || "rooms_tileset"
    const tileset = this.map.addTilesetImage(tilesetName, "rooms_tileset")
    if (!tileset) throw new Error("Failed to load tileset")

    this.bgLayer = this.map.createLayer("Background", tileset, 0, 0)!
    this.wallsLayer = this.map.createLayer("Walls", tileset, 0, 0)!
    if (this.wallsLayer) this.wallsLayer.setCollisionBetween(0, 3)
    this.wallsLayer.setCollisionByProperty({ collides: true })

    // render-only grouping (physics unaffected)
    this.roomLayer = this.scene.add.layer()

    // --- overlay UNDER the background (rendered by roomCam) ---
    const mapW = this.map.widthInPixels
    const mapH = this.map.heightInPixels
    this.roomOverlay = this.scene.add.rectangle(
      mapW / 2,
      mapH / 2,
      mapW,
      mapH,
      0x000000,
      0.5
    ) // dim strength here
    this.roomOverlay.setDepth(0)

    // order: overlay < bg < player < walls
    this.bgLayer.setDepth(10)
    this.scene.player.setDepth(20)
    this.wallsLayer.setDepth(30)

    // add to room render stack
    this.roomLayer.add([this.roomOverlay, this.bgLayer, this.wallsLayer])

    // move player into room (rendering only)
    this.scene.player.setPosition(spawnPoint.x, spawnPoint.y)
    this.scene.player.setScale(RoomManager.PLAYER_SCALE)
    this.roomLayer.add(this.scene.player)

    // disable outside collisions
    if (this.scene.outsideColliders) {
      this.scene.outsideColliders.forEach((c) => (c.active = false))
    }

    // collide with room walls
    this.roomColliders.push(
      this.scene.physics.add.collider(this.scene.player, this.wallsLayer)
    )

    // ---- ROOM CAMERA: centered, 85% width, keep map aspect ----
    const sw = this.scene.scale.width
    const sh = this.scene.scale.height
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
    const zoom = Math.min(viewW / mapW, viewH / mapH)
    this.roomCam.setZoom(zoom).setBounds(0, 0, mapW, mapH)
    this.roomCam.startFollow(this.scene.player, true, 0.15, 0.15)

    // prevent double render: mainCam ignores the room render layer
    const mainCam = this.scene.cameras.main
    mainCam.stopFollow()
    mainCam.ignore(this.roomLayer)
    // (no separate UI/backdrop here; overlay is inside the room now)
  }

  exitRoom(exitPoint: Phaser.Math.Vector2) {
    this.roomColliders.forEach((c) => c.destroy())
    this.roomColliders = []

    if (this.roomCam) {
      this.scene.cameras.remove(this.roomCam, true)
      this.roomCam = undefined
    }

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

    if (this.scene.outsideColliders) {
      this.scene.outsideColliders.forEach((c) => (c.active = true))
    }

    // restore main camera follow
    const mainCam = this.scene.cameras.main
    mainCam.startFollow(this.scene.player, true, 0.15, 0.15)

    // detach player from room layer and reset depth
    if (this.roomLayer) {
      this.roomLayer.remove(this.scene.player)
      this.roomLayer.destroy()
      this.roomLayer = undefined
    }
    this.scene.player.setDepth(0)
    this.scene.player.setPosition(exitPoint.x, exitPoint.y)
  }
}
