import GameScene from "./scenes/GameScene"

export function PreloadAssets(scene: GameScene) {
  GameScene.totalPlayers = 0

  scene.textures.generate("blank", {
    data: ["."],
    pixelWidth: 1,
    pixelHeight: 1,
  })

  scene.load.image("tileset", "/map-items/tileset.png")
  scene.load.image("rooms_tileset", "/map-items/rooms_tileset.png")

  scene.load.tilemapTiledJSON("map", "/map-items/tiled-files/tiled-map.tmj")
  scene.load.tilemapTiledJSON("room_one", "/map-items/rooms/room_one.tmj")
  scene.load.tilemapTiledJSON("room_two", "/map-items/rooms/room_two.tmj")
  scene.load.tilemapTiledJSON("room_three", "/map-items/rooms/room_three.tmj")
  scene.load.tilemapTiledJSON("room_four", "/map-items/rooms/room_four.tmj")

  scene.load.image("white-circle", "/images/white-circle.png")
  scene.load.image("house", "/images/temp/house.png")
  scene.load.image("stone", "/images/temp/stone.png")
  scene.load.image("player", "/images/player.png")
  scene.load.image("helmet", "/images/helmet.png")
  scene.load.image("vest", "/images/vest.png")
  scene.load.image("pistol", "/images/guns/pistol.png")
  scene.load.image("ak47", "/images/guns/ak47.png")
  scene.load.image("sniper", "/images/guns/sniper.png")
  scene.load.image("shotgun", "/images/guns/shotgun.png")
  scene.load.image("painkiller", "/images/painkiller.png")
  scene.load.image("pistol_ammo", "/images/guns/pistol-ammo-ground.png")
  scene.load.image("ak47_ammo", "/images/guns/ak47-ammo-ground.png")
  scene.load.image("shotgun_ammo", "/images/guns/shotgun-ammo-ground.png")
  scene.load.image("sniper_ammo", "/images/guns/sniper-ammo-ground.png")
  scene.load.image("pistol-bullet", "/images/guns/pistol-bullet.png")
  scene.load.image("ak47-bullet", "/images/guns/ak47-bullet.png")
  scene.load.image("sniper-bullet", "/images/guns/sniper-bullet.png")
  scene.load.image("shotgun-bullet", "/images/guns/shotgun-bullet.png")
  scene.load.image("villian", "/images/villian.png")
  scene.load.image("ouchwrap", "/images/collectables/ouchwrap.png")
  scene.load.image("healbox", "/images/collectables/healbox.png")
  scene.load.image("grave-box", "/images/collectables/grave-box.png")
  scene.load.image("boomnut", "/images/collectables/boomnut.png")
  scene.load.image("faster-boi", "/images/collectables/faster-boi.png")
  scene.load.image("sliptrap", "/images/collectables/sliptrap.png")
  scene.load.image(
    "slowmo-injection", 
    "/images/collectables/slowmo-injection.png"
  )
  scene.load.image(
    "ouchwrap-no-glow",
    "/images/collectables/without-glow/ouchwrap.png"
  )
  scene.load.image(
    "healbox-no-glow",
    "/images/collectables/without-glow/healbox.png"
  )
  scene.load.image(
    "boomnut-no-glow",
    "/images/collectables/without-glow/boomnut.png"
  )

  scene.load.font("BRF", "/fonts/BRF.otf", "opentype")
}
