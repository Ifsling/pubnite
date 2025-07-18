import GameScene from "./scenes/GameScene"

export function PreloadAssets(scene: GameScene) {
  scene.load.image("background", "/images/temp/bg.png")
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
}
