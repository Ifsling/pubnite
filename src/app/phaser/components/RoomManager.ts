import { AddPhysicsItem } from "../HelperFunctions"
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

  // ---- loot config ----
  private static readonly ROOM_GUN_KEYS = [
    "pistol",
    "ak47",
    "shotgun",
    "sniper",
  ] as const
  private static readonly ROOM_AMMO_KEYS = [
    "pistol_ammo",
    "ak47_ammo",
    "shotgun_ammo",
    "sniper_ammo",
  ] as const
  private static readonly AMMO_BY_GUN: Record<
    (typeof RoomManager.ROOM_GUN_KEYS)[number],
    (typeof RoomManager.ROOM_AMMO_KEYS)[number]
  > = {
    pistol: "pistol_ammo",
    ak47: "ak47_ammo",
    shotgun: "shotgun_ammo",
    sniper: "sniper_ammo",
  }

  // occasional room misc items (reuse your world items)
  private static readonly ROOM_MISC_KEYS = [
    "ouchwrap", // bandage
    "healbox", // medkit
    "boomnut", // grenade
    "slowmo-injection", // syringe
    "faster-boi", // speed
    "sliptrap", // banana/slip
  ] as const

  // per-open-tile probabilities (keep small; rooms are dense)
  private static readonly P_GUN = 0.015 // 1.5% chance per open tile
  private static readonly P_AMMO = 0.02 // 2%
  private static readonly P_MISC = 0.004 // 0.4%

  // caps so tiny rooms don't flood
  private static readonly MAX_GUNS_PER_ROOM = 4
  private static readonly MAX_AMMO_PER_ROOM = 6
  private static readonly MAX_MISC_PER_ROOM = 2

  private static readonly ROOM_GUN_MIN_DIST_FROM_SPAWN = 64 // px, keep door clear
  private static readonly ROOM_ITEM_SCALE = 0.3 // visual size for pickups

  private prevWorldBounds?: Phaser.Geom.Rectangle

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

  private decoyCollider?: Phaser.Physics.Arcade.Collider

  constructor(scene: GameScene) {
    this.scene = scene
  }

  isActive() {
    return this.active
  }

  update() {
    // not in a room? bail
    if (!this.active || !this.doorLayer || !this.eKey) return

    const player = this.scene.player
    const body = (player && (player.body as Phaser.Physics.Arcade.Body)) || null
    if (!body) return // player not ready / died / body disabled

    const tiles = this.doorLayer.getTilesWithinWorldXY(
      body.x,
      body.y,
      body.width,
      body.height
    )
    const atDoor = tiles.some((tile) => tile.index !== -1)

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

    // remember outside world bounds
    const b = this.scene.physics.world.bounds
    this.prevWorldBounds = new Phaser.Geom.Rectangle(
      b.x,
      b.y,
      b.width,
      b.height
    )

    // 1) decoy outside (bots can still see/shoot it)
    this.makeDecoyAtDoor(entryPointOutside)
    this.wireDecoyDamageRelay()
    this.retargetEnemiesToDecoy()

    // 2) tilemap & layers
    this.map = this.scene.make.tilemap({ key: roomKey })
    const tilesetName = this.map.tilesets[0]?.name || "rooms_tileset"
    const tileset = this.map.addTilesetImage(tilesetName, "rooms_tileset")
    if (!tileset) throw new Error("Failed to load rooms tileset")

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
    this.doorLayer.setDepth(15)
    this.scene.player.setDepth(20)
    this.wallsLayer.setDepth(30)
    this.roomLayer.add([this.bgLayer, this.doorLayer, this.wallsLayer])

    // 4) spawn **at the door layer center**
    const spawn = this.getDoorSpawnFromTileLayer(this.doorLayer)
    this.scene.player.setPosition(spawn.x, spawn.y)
    this.scene.player.setScale(RoomManager.PLAYER_SCALE)
    this.scene.player.setSpeed(250)
    this.roomLayer.add(this.scene.player)

    // 5) now that layers & roomLayer exist, spawn loot inside room
    this.spawnLootInRoom()

    // 6) disable outside colliders
    this.scene.outsideColliders?.forEach((c) => (c.active = false))

    // 7) collide with room walls
    this.roomColliders.push(
      this.scene.physics.add.collider(this.scene.player, this.wallsLayer)
    )
    // 7b) bullets vs room walls (destroy on hit while inside the room)
    this.roomColliders.push(
      this.scene.physics.add.collider(
        this.scene.playerBullets,
        this.wallsLayer as Phaser.Tilemaps.TilemapLayer,
        (obj1 /* bullet */, _obj2 /* tile */) => {
          const b = obj1 as Phaser.Physics.Arcade.Sprite
          if (b.active) b.destroy()
        }
      )
    )

    this.roomColliders.push(
      this.scene.physics.add.collider(
        this.scene.enemyBullets,
        this.wallsLayer as Phaser.Tilemaps.TilemapLayer,
        (obj1 /* bullet */, _obj2 /* tile */) => {
          const b = obj1 as Phaser.Physics.Arcade.Sprite
          if (b.active) b.destroy()
        }
      )
    )

    // 8) camera: centered viewport, zoom in so room > viewport
    const sw = this.scene.scale.width
    const sh = this.scene.scale.height
    const mapW = this.map.widthInPixels
    const mapH = this.map.heightInPixels
    const aspect = mapW / mapH

    this.scene.physics.world.setBounds(0, 0, mapW, mapH)
    this.scene.physics.world.setBoundsCollision(true, true, true, true)

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

    // 9) big overlay under bg (not cropped)
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

    // 10) blink the **Door** layer
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

    // 11) visibility routing: roomCam draws only roomLayer; mainCam ignores it
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
    this.active = false
    this.eKey = undefined

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
    this.decoyCollider?.destroy()
    this.decoyCollider = undefined
    this.clearEnemyExplicitTargets()
    if (this.dummyPlayer) {
      this.dummyPlayer.destroy()
      this.dummyPlayer = undefined
    }

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

    if (this.prevWorldBounds) {
      const b = this.prevWorldBounds
      this.scene.physics.world.setBounds(b.x, b.y, b.width, b.height)
      this.prevWorldBounds = undefined
    }
  }

  // ---- helpers ----

  public getAimWorld(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const cam =
      this.active && this.roomCam ? this.roomCam : this.scene.cameras.main
    const out = new Phaser.Math.Vector2()
    pointer.positionToCamera(cam, out as any) // fills out.x/out.y with cam-space world coords
    return out
  }

  public attachToRoom(go: Phaser.GameObjects.GameObject) {
    if (this.roomLayer) this.roomLayer.add(go)
  }
  public isInsideRoom() {
    return this.active
  }

  private wireDecoyDamageRelay() {
    this.decoyCollider?.destroy()
    if (!this.dummyPlayer) return

    // Enemy bullets hitting the decoy should damage the real player.
    this.decoyCollider = this.scene.physics.add.overlap(
      this.scene.enemyBullets,
      this.dummyPlayer,
      (bullet: any) => {
        const dmg = bullet?.damage ?? 10
        this.scene.player.takeDamage(dmg)
        bullet?.destroy?.()
      }
    )
  }

  private retargetEnemiesToDecoy() {
    if (!this.dummyPlayer) return
    this.scene.enemies.forEach((e) =>
      (e as any).setExplicitTarget?.(this.dummyPlayer)
    )
  }

  private clearEnemyExplicitTargets() {
    this.scene.enemies.forEach((e) => (e as any).setExplicitTarget?.(null))
  }

  private makeDecoyAtDoor(entry: Phaser.Math.Vector2) {
    this.dummyPlayer = this.scene.add.sprite(entry.x, entry.y, "player")
    this.scene.physics.world.enable(this.dummyPlayer)
    const dBody = this.dummyPlayer.body as Phaser.Physics.Arcade.Body

    // Make it feel like a “standing” player outside.
    dBody.setImmovable(true).setAllowGravity(false)
    this.dummyPlayer.setDepth(5)

    // match player body size/offset so bullets overlap reliably
    // const pBody = this.scene.player.body as Phaser.Physics.Arcade.Body
    // dBody.setSize(pBody.width, pBody.height)
    // dBody.setOffset(pBody.offset.x, pBody.offset.y)
  }

  // Gather world-space centers of tiles that are *not* walls or door.
  private getOpenTileCenters(): Phaser.Math.Vector2[] {
    if (!this.map || !this.wallsLayer || !this.doorLayer) return []

    const tw = this.map.tileWidth
    const th = this.map.tileHeight
    const open: Phaser.Math.Vector2[] = []

    for (let ty = 0; ty < this.map.height; ty++) {
      for (let tx = 0; tx < this.map.width; tx++) {
        const hasWall = this.wallsLayer.hasTileAt(tx, ty)
        const hasDoor = this.doorLayer.hasTileAt(tx, ty)
        if (hasWall || hasDoor) continue
        const wx = this.wallsLayer.tileToWorldX(tx) + tw / 2
        const wy = this.wallsLayer.tileToWorldY(ty) + th / 2
        open.push(new Phaser.Math.Vector2(wx, wy))
      }
    }
    return open
  }

  // Spawn guns + ammo + a little misc loot on open tiles, visible to the roomCam.
  private spawnLootInRoom() {
    if (!this.map || !this.roomLayer || !this.wallsLayer || !this.doorLayer)
      return

    const openCenters = this.getOpenTileCenters()
    if (!openCenters.length) return

    const doorSpawn = this.getDoorSpawnFromTileLayer(this.doorLayer)

    // registry to avoid stacking items on the same tile
    const occupied: Phaser.Math.Vector2[] = []
    const tooClose = (a: Phaser.Math.Vector2, b: Phaser.Math.Vector2, d = 28) =>
      Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) < d

    let guns = 0
    let ammo = 0
    let misc = 0

    for (const pt of openCenters) {
      if (
        Phaser.Math.Distance.Between(pt.x, pt.y, doorSpawn.x, doorSpawn.y) <
        RoomManager.ROOM_GUN_MIN_DIST_FROM_SPAWN
      ) {
        continue
      }
      if (occupied.some((p) => tooClose(p, pt))) continue

      // 1) Gun roll
      if (
        guns < RoomManager.MAX_GUNS_PER_ROOM &&
        Math.random() < RoomManager.P_GUN
      ) {
        const gunKey =
          RoomManager.ROOM_GUN_KEYS[
            (Math.random() * RoomManager.ROOM_GUN_KEYS.length) | 0
          ]
        const item = AddPhysicsItem(
          this.scene,
          gunKey,
          pt.x,
          pt.y,
          /* isCollectable */ true,
          /* isCollidable */ false,
          /* isImmovable  */ true,
          /* pickupType   */ "gun",
          /* scale        */ RoomManager.ROOM_ITEM_SCALE
        )
        this.roomLayer.add(item)
        ;(item as Phaser.GameObjects.Sprite).setDepth(18)
        occupied.push(pt.clone())
        guns++

        // small chance to drop matching ammo next to gun
        if (ammo < RoomManager.MAX_AMMO_PER_ROOM && Math.random() < 0.5) {
          const ammoKey = RoomManager.AMMO_BY_GUN[gunKey]
          const dir = Phaser.Math.Angle.Random()
          const off = new Phaser.Math.Vector2(
            pt.x + Math.cos(dir) * 22,
            pt.y + Math.sin(dir) * 22
          )
          const ammoItem = AddPhysicsItem(
            this.scene,
            ammoKey,
            off.x,
            off.y,
            true,
            false,
            true,
            "ammo",
            RoomManager.ROOM_ITEM_SCALE
          )
          this.roomLayer.add(ammoItem)
          ;(ammoItem as Phaser.GameObjects.Sprite).setDepth(18)
          occupied.push(off)
          ammo++
        }
        continue
      }

      // 2) Ammo roll
      if (
        ammo < RoomManager.MAX_AMMO_PER_ROOM &&
        Math.random() < RoomManager.P_AMMO
      ) {
        const ammoKey =
          RoomManager.ROOM_AMMO_KEYS[
            (Math.random() * RoomManager.ROOM_AMMO_KEYS.length) | 0
          ]
        const item = AddPhysicsItem(
          this.scene,
          ammoKey,
          pt.x,
          pt.y,
          true,
          false,
          true,
          "ammo",
          RoomManager.ROOM_ITEM_SCALE
        )
        this.roomLayer.add(item)
        ;(item as Phaser.GameObjects.Sprite).setDepth(18)
        occupied.push(pt.clone())
        ammo++
        continue
      }

      // 3) Misc roll
      if (
        misc < RoomManager.MAX_MISC_PER_ROOM &&
        Math.random() < RoomManager.P_MISC
      ) {
        const key =
          RoomManager.ROOM_MISC_KEYS[
            (Math.random() * RoomManager.ROOM_MISC_KEYS.length) | 0
          ]
        const pickupType =
          key === "ouchwrap" ||
          key === "healbox" ||
          key === "boomnut" ||
          key === "slowmo-injection"
            ? "bagItem"
            : key === "faster-boi"
            ? "faster-boi"
            : key === "sliptrap"
            ? "sliptrap"
            : "bagItem"

        const item = AddPhysicsItem(
          this.scene,
          key,
          pt.x,
          pt.y,
          true,
          false,
          true,
          pickupType,
          RoomManager.ROOM_ITEM_SCALE
        )
        this.roomLayer.add(item)
        ;(item as Phaser.GameObjects.Sprite).setDepth(18)
        occupied.push(pt.clone())
        misc++
      }
    }
  }

  // Compute a spawn point from a tile layer: center of bounding box of the layer's set tiles.
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
