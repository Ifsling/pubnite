import { MAP_SCALE_FACTOR } from "../Constants"
import GameScene from "../scenes/GameScene"
import { mapItemsData } from "./TEMP_mapData"

export function createMap(scene: GameScene) {
  const map = scene.make.tilemap({ key: "map" })
  const tileset = map.addTilesetImage(
    map.tilesets[0]?.name || "tileset",
    "tileset"
  )
  if (!tileset) throw new Error("Failed to load tileset")

  const backgroundLayer =
    map.createLayer("Background", tileset, 0, 0)?.setScale(MAP_SCALE_FACTOR) ||
    null
  const trees =
    map.createLayer("Trees", tileset, 0, 0)?.setScale(MAP_SCALE_FACTOR) || null
  const water =
    map.createLayer("Water", tileset, 0, 0)?.setScale(MAP_SCALE_FACTOR) || null
  const houses =
    map.createLayer("Houses", tileset, 0, 0)?.setScale(MAP_SCALE_FACTOR) || null
  const road =
    map.createLayer("Road", tileset, 0, 0)?.setScale(MAP_SCALE_FACTOR) || null
  const bridge =
    map.createLayer("Bridge", tileset, 0, 0)?.setScale(MAP_SCALE_FACTOR) || null
  const bush =
    map.createLayer("Bush", tileset, 0, 0)?.setScale(MAP_SCALE_FACTOR) || null
  const stones =
    map.createLayer("Stones", tileset, 0, 0)?.setScale(MAP_SCALE_FACTOR) || null

  // Set collision for houses and water
  houses?.setCollisionBetween(0, 53)
  water?.setCollisionBetween(0, 54)
  trees?.setCollisionBetween(0, 54)
  stones?.setCollisionBetween(0, 54)
  bush?.setCollisionBetween(0, 54)

  const { widthInPixels, heightInPixels } = map

  scene.physics.world.setBounds(
    0,
    0,
    widthInPixels * MAP_SCALE_FACTOR,
    heightInPixels * MAP_SCALE_FACTOR
  )
  scene.cameras.main.setBounds(
    0,
    0,
    widthInPixels * MAP_SCALE_FACTOR,
    heightInPixels * MAP_SCALE_FACTOR
  )

  return {
    map,
    tileset,
    backgroundLayer,
    trees,
    water,
    houses,
    road,
    bridge,
    bush,
    stones,
  }
}

export function spawnableLocations() {
  let locations = []

  let target, exists

  const width = mapItemsData.width
  const height = mapItemsData.height

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      locations.push({ x, y })
    }
  }

  target = { x: 20, y: 7 }
  console.log("exists 1 -> ", DoesItExist(locations, target))

  const blocked = new Set()

  mapItemsData.layers.forEach((layer) => {
    if (
      layer.name === "Background" ||
      layer.name === "Road" ||
      layer.name === "Bridge"
    )
      return

    layer.data.forEach((tileId, index) => {
      if (tileId !== 0) {
        const x = index % width
        const y = Math.floor(index / width)

        blocked.add(`${x},${y}`)
      }
    })
  })

  const manualBlocked = [
    [0, 0],
    [0, 1],
    [1, 2],
    [1, 29],
    [0, 29],
    [28, 0],
    [29, 0],
  ]

  const manualAllowed = [
    [20, 7],
    [21, 10],
    [22, 10],
    [21, 11],
    [22, 11],
    [23, 10],
    [23, 11],
    [24, 11],
    [21, 12],
    [21, 13],
    [21, 14],
    [21, 15],
    [22, 14],
  ]

  manualBlocked.forEach(([x, y]) => blocked.add(`${x},${y}`))

  locations = locations.filter((pos) => !blocked.has(`${pos.x},${pos.y}`))

  manualAllowed.forEach(([x, y]) => {
    locations.push({ x, y })
  })

  console.log("exists 2 -> ", DoesItExist(locations, target))

  return locations
}

function DoesItExist(
  locations: { x: number; y: number }[],
  target: { x: number; y: number }
) {
  return locations.some((obj) => obj.x === target.x && obj.y === target.y)
}
