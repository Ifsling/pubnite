// SpreadHouseEntries.ts
import { houseEntryPoints, MAP_SCALE_FACTOR } from "../Constants"
import GameScene from "../scenes/GameScene"
import { HouseEntryPoint } from "./particles/HouseEntryPoint"
import RoomManager from "./RoomManager"

const roomTypes = ["room_one", "room_two", "room_three", "room_four"]

export default function SpreadHouseEntries(
  scene: GameScene,
  roomManager: RoomManager
) {
  houseEntryPoints.forEach((point) => {
    const x =
      point[0] * scene.map.tileWidth * MAP_SCALE_FACTOR + 150 * MAP_SCALE_FACTOR
    const y =
      point[1] * scene.map.tileHeight * MAP_SCALE_FACTOR +
      150 * MAP_SCALE_FACTOR

    const randRoomType = roomTypes[Math.floor(Math.random() * roomTypes.length)]

    const entryPoint = new HouseEntryPoint(scene, x, y, () => {
      // world spot to return to after exiting (current player pos is typical)
      const exitToWorld = new Phaser.Math.Vector2(
        scene.player.x,
        scene.player.y
      )

      // prevent re-enter spam if already inside
      if (roomManager.isActive()) return

      roomManager.enterRoom(randRoomType, exitToWorld)
    })

    scene.roomsInformation.push({
      point: [x, y],
      room_type: randRoomType,
      looted: false,
      noOfItemsLooted: 0,
    })
  })
}
