import { MAP_SCALE_FACTOR } from "./phaser/Constants"
import { spawnableLocations } from "./phaser/map/Map"

export function getOneSpawnLocationWithinMap() {
  const locations = spawnableLocations()
  const randNum = Math.floor(Math.random() * locations.length)
  const randGridPoint: { x: number; y: number } = locations[randNum]

  return {
    x: randGridPoint.x * 300 * MAP_SCALE_FACTOR + 150 * MAP_SCALE_FACTOR,
    y: randGridPoint.y * 300 * MAP_SCALE_FACTOR + 150 * MAP_SCALE_FACTOR,
  }
}
export function getRandomSpawnLocationWithinRadius(
  x: number,
  y: number,
  radius: number
) {
  const locations = spawnableLocations()
  const randomPointsWithinReach = locations.filter((roadPoint) => {
    // Convert grid coordinates to world coordinates
    const { x: gridX, y: gridY } = gridToWorldCoordinates(
      roadPoint.x,
      roadPoint.y
    )

    const distance = calculateDistance({ x, y }, { x: gridX, y: gridY })
    return distance <= radius
  })

  if (randomPointsWithinReach.length === 0) {
    return { x: -1, y: -1 }
  }

  const randNum = Math.floor(Math.random() * randomPointsWithinReach.length)
  const randGridPoint = randomPointsWithinReach[randNum]

  return {
    x: randGridPoint.x * 300 * MAP_SCALE_FACTOR + 150 * MAP_SCALE_FACTOR,
    y: randGridPoint.y * 300 * MAP_SCALE_FACTOR + 150 * MAP_SCALE_FACTOR,
  }
}

export function calculateDistance(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
) {
  const dx = point1.x - point2.x
  const dy = point1.y - point2.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function gridToWorldCoordinates(
  gridX: number,
  gridY: number
): { x: number; y: number } {
  return {
    x: (gridX - 1) * 300 * MAP_SCALE_FACTOR + 150 * MAP_SCALE_FACTOR,
    y: (gridY - 1) * 300 * MAP_SCALE_FACTOR + 150 * MAP_SCALE_FACTOR,
  }
}
