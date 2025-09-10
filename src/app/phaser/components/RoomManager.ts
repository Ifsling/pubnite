import GameScene from "../scenes/GameScene"

export default class RoomManager {
  scene: GameScene

  // ---- easy tweaks ----
  private static readonly ROOM_VIEW_PCT = 0.9
  private static readonly ROOM_MAX_HEIGHT_PCT = 0.95
  private static readonly PLAYER_SCALE = 0.3
  private static readonly ROOM_ZOOM_MULT = 2.4
  private static readonly ROOM_ZOOM_MAX = 4
  private static readonly OVERLAY_ALPHA = 0.5
  private static readonly OVERLAY_PAD_MULT = 1.2

  private static readonly DOOR_ALPHA_MIN = 0.25
  private static readonly DOOR_ALPHA_MAX = 0.85
  private static readonly DOOR_TWEEN_MS = 650

  private map?: Phaser.Tilemaps.Tilemap
  private bgLayer?: Phaser.Tilemaps.TilemapLayer
  private wallsLayer?: Phaser.Tilemaps.TilemapLayer
  private doorLayer?: Phaser.Tilemaps.TilemapLayer
  private roomLayer?: Phaser.GameObjects.Layer
  private roomOverlay?: Phaser.GameObjects.Rectangle
  private roomCam?: Phaser.Cameras.Scene2D.Camera
  private active = false

  private eKey?: Phaser.Input.Keyboard.Key
  private entryPointOutside?: Phaser.Math.Vector2

  private roomColliders: Phaser.Physics.Arcade.Collider[] = []
  private dummyPlayer?: Phaser.GameObjects.Sprite

  constructor(scene: GameScene) {
    this.scene = scene
  }

  isActive() {
    return this.active
  }

  // call from GameScene.update()
  update() {
    if (!this.doorLayer || !this.eKey) return

    // Cheap per-frame test: is player's body overlapping any door tile?
    const atDoor = this.scene.physics.overlap(this.scene.player, this.doorLayer)
    if (atDoor && Phaser.Input.Keyboard.JustDown(this.eKey)) {
      const exit =
        this.entryPointOutside ??
        new Phaser.Math.Vector2(this.scene.player.x, this.scene.player.y)
      this.exitRoom(exit)
    }
  }

  enterRoom(roomKey: string, entryPointOutside: Phaser.Math.Vector2) {
    if (this.active) return
    this.active = true

    this.entryPointOutside = entryPointOutside

    // 1) decoy outside (bots can still see/shoot it)
    this.dummyPlayer = this.scene.add.sprite(
      entryPointOutside.x,
      entryPointOutside.y,
      "player"
    )
    this.scene.physics.world.enable(this.dummyPlayer)

    // 2) tilemap & layers
    this.map = this.scene.make.tilemap({ key: roomKey })
    const tilesetName = this.map.tilesets[0]?.name || "rooms_tileset"
    const tileset = this.map.addTilesetImage(tilesetName, "rooms_tileset")
    if (!tileset) throw new Error("Failed to load tileset")

    this.bgLayer = this.map.createLayer("Background", tileset, 0, 0)!
    this.wallsLayer = this.map.createLayer("Walls", tileset, 0, 0)!
    this.doorLayer = this.map.createLayer("Door", tileset, 0, 0)!

    // collisions
    if (this.wallsLayer) this.wallsLayer.setCollisionBetween(0, 5)
    if (this.doorLayer) this.doorLayer.setCollisionBetween(0, 5)
    this.wallsLayer.setCollisionByProperty({ collides: true })

    // 3) render grouping
    this.roomLayer = this.scene.add.layer()
    this.bgLayer.setDepth(10)
    this.doorLayer.setDepth(15) // draw above background
    this.scene.player.setDepth(20)
    this.wallsLayer.setDepth(30)
    this.roomLayer.add([this.bgLayer, this.doorLayer, this.wallsLayer])

    // 4) spawn **at the door layer center**
    const spawn = this.getDoorSpawnFromTileLayer(this.doorLayer)
    this.scene.player.setPosition(spawn.x, spawn.y)
    this.scene.player.setScale(RoomManager.PLAYER_SCALE)
    this.scene.player.setSpeed(250)
    this.roomLayer.add(this.scene.player)

    // 5) disable outside colliders
    this.scene.outsideColliders?.forEach((c) => (c.active = false))

    // 6) collide with room walls
    this.roomColliders.push(
      this.scene.physics.add.collider(this.scene.player, this.wallsLayer)
    )

    // 7) camera: centered viewport, zoom in so room > viewport
    const sw = this.scene.scale.width
    const sh = this.scene.scale.height
    const mapW = this.map.widthInPixels
    const mapH = this.map.heightInPixels
    const aspect = mapW / mapH

    let viewW = Math.round(sw * RoomManager.ROOM_VIEW_PCT)
    let viewH = Math.round(viewW / aspect)
    const maxH = Math.floor(sh * RoomManager.ROOM_MAX_HEIGHT_PCT)
    if (viewH > maxH) {
      viewH = maxH
      viewW = Math.round(viewH * aspect)
    }
    const vx = Math.round((sw - viewW) / 2)
    const vy = Math.round((sh - viewH) / 2)

    this.roomCam = this.scene.cameras.add(vx, vy, viewW, viewH)
    const baseCoverZoom = Math.max(viewW / mapW, viewH / mapH)
    const zoom = Phaser.Math.Clamp(
      baseCoverZoom * RoomManager.ROOM_ZOOM_MULT,
      0.1,
      RoomManager.ROOM_ZOOM_MAX
    )
    this.roomCam
      .setZoom(zoom)
      .setBounds(0, 0, mapW, mapH)
      .startFollow(this.scene.player, true, 0.15, 0.15)

    // 8) big overlay under bg (not cropped)
    const visWorldW = viewW / zoom
    const visWorldH = viewH / zoom
    const overlayW = mapW + visWorldW * RoomManager.OVERLAY_PAD_MULT * 2
    const overlayH = mapH + visWorldH * RoomManager.OVERLAY_PAD_MULT * 2
    this.roomOverlay = this.scene.add
      .rectangle(
        mapW / 2,
        mapH / 2,
        overlayW,
        overlayH,
        0x000000,
        RoomManager.OVERLAY_ALPHA
      )
      .setDepth(0)
    this.roomLayer.addAt(this.roomOverlay, 0)

    // 9) blink the **Door** tile layer (whole layer alpha)
    this.scene.tweens.add({
      targets: this.doorLayer,
      alpha: {
        from: RoomManager.DOOR_ALPHA_MIN,
        to: RoomManager.DOOR_ALPHA_MAX,
      },
      yoyo: true,
      duration: RoomManager.DOOR_TWEEN_MS,
      repeat: -1,
      ease: "Sine.InOut",
    })

    // 10) visibility routing: roomCam draws only roomLayer; mainCam ignores it
    const allChildren = this.scene.children
      .list as Phaser.GameObjects.GameObject[]
    const roomLayerGO = this
      .roomLayer as unknown as Phaser.GameObjects.GameObject
    this.roomCam.ignore(allChildren.filter((go) => go !== roomLayerGO))
    const mainCam = this.scene.cameras.main
    mainCam.stopFollow()
    mainCam.ignore(roomLayerGO)

    // E key
    this.eKey = this!.scene!.input!.keyboard!.addKey("E")
  }

  exitRoom(exitPointOutside: Phaser.Math.Vector2) {
    this.scene.player.setSpeed(-1)
    this.scene.player.setScale(1)

    // physics + camera cleanup
    this.roomColliders.forEach((c) => c.destroy())
    this.roomColliders = []
    if (this.roomCam) {
      this.scene.cameras.remove(this.roomCam, true)
      this.roomCam = undefined
    }

    // visuals
    this.roomOverlay?.destroy()
    this.roomOverlay = undefined
    this.bgLayer?.destroy()
    this.bgLayer = undefined
    this.wallsLayer?.destroy()
    this.wallsLayer = undefined
    this.doorLayer?.destroy()
    this.doorLayer = undefined
    this.map?.destroy()
    this.map = undefined

    // decoy off
    this.dummyPlayer?.destroy()
    this.dummyPlayer = undefined

    // re-enable outside collisions
    this.scene.outsideColliders?.forEach((c) => (c.active = true))

    // restore main cam
    const mainCam = this.scene.cameras.main
    mainCam.startFollow(this.scene.player, true, 0.15, 0.15)

    // remove render layer
    if (this.roomLayer) {
      this.roomLayer.remove(this.scene.player)
      this.scene.add.existing(this.scene.player)
      this.roomLayer.destroy()
      this.roomLayer = undefined
    }

    // reset key
    this.eKey = undefined

    // move player back outside
    this.scene.player.setDepth(10)
    this.scene.player.setPosition(exitPointOutside.x, exitPointOutside.y)

    this.active = false
  }

  // ---- helpers ----

  // Compute a good spawn point from a tile layer: center of the bounding box of all set tiles.
  private getDoorSpawnFromTileLayer(
    layer: Phaser.Tilemaps.TilemapLayer
  ): Phaser.Math.Vector2 {
    const tiles = layer.getTilesWithin(
      0,
      0,
      layer.layer.width,
      layer.layer.height,
      { isNotEmpty: true }
    )
    if (!tiles.length) {
      // fallback: map center
      return new Phaser.Math.Vector2(
        this.map!.widthInPixels / 2,
        this.map!.heightInPixels / 2
      )
    }
    let minTX = Infinity,
      minTY = Infinity,
      maxTX = -Infinity,
      maxTY = -Infinity
    for (const t of tiles) {
      minTX = Math.min(minTX, t.x)
      minTY = Math.min(minTY, t.y)
      maxTX = Math.max(maxTX, t.x)
      maxTY = Math.max(maxTY, t.y)
    }
    const centerTX = (minTX + maxTX + 1) / 2
    const centerTY = (minTY + maxTY + 1) / 2
    const worldX = layer.tileToWorldX(centerTX)
    const worldY = layer.tileToWorldY(centerTY)
    return new Phaser.Math.Vector2(worldX, worldY)
  }
}
