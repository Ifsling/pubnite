import { houseEntryPoints, MAP_SCALE_FACTOR } from "../Constants"
import GameScene from "../scenes/GameScene"
import { HouseEntryPoint } from "./particles/HouseEntryPoint"
import RoomManager from "./RoomManager"

export default function SpreadHouseEntries(scene: GameScene) {
  houseEntryPoints.forEach((point) => {
    const x =
      point[0] * scene.map.tileWidth * MAP_SCALE_FACTOR + 150 * MAP_SCALE_FACTOR
    const y =
      point[1] * scene.map.tileHeight * MAP_SCALE_FACTOR +
      150 * MAP_SCALE_FACTOR

    const entryPoint = new HouseEntryPoint(scene, x, y, () => {
      const roomSpawn = new Phaser.Math.Vector2(200, 200) // inside room spawn
      const entryPoint = new Phaser.Math.Vector2(1000, 1200) // world entry

      new RoomManager(scene).enterRoom("room_one", roomSpawn, entryPoint)
    })
  })
}
