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
}
