// src/components/pathfinding/SetupEasyStar.ts
import EasyStar from "easystarjs"
import { MAP_SCALE_FACTOR } from "../../Constants" // <-- use the real constant
import GameScene from "../../scenes/GameScene"

const WALKABLE_LAYERS = ["Background", "Road", "Bridge"]
const BLOCKING_LAYERS = ["Houses", "Trees", "Bush", "Stones", "Water"]

export function SetupEasyStar(scene: GameScene) {
  const easystar = new EasyStar.js()
  const map = scene.map

  const width = map.width
  const height = map.height

  const grid: number[][] = new Array(height)

  for (let y = 0; y < height; y++) {
    const row: number[] = new Array(width)
    for (let x = 0; x < width; x++) {
      const isBlocked = BLOCKING_LAYERS.some(
        (layer) => !!map.getTileAt(x, y, false, layer)
      )
      const isWalkable =
        !isBlocked &&
        WALKABLE_LAYERS.some((layer) => !!map.getTileAt(x, y, false, layer))
      row[x] = isWalkable ? 0 : 1
    }
    grid[y] = row
  }

  easystar.setGrid(grid)
  easystar.setAcceptableTiles([0])
  easystar.disableDiagonals()
  easystar.disableCornerCutting()
  easystar.setIterationsPerCalculation(1000)
  ;(scene as any).easystar = easystar
  ;(scene as any).pathGrid = grid

  // drive the solver
  scene.events.on("update", () => easystar.calculate())

  // Helpers using the SAME scale your map uses
  const tileW = map.tileWidth
  const tileH = map.tileHeight
  const scale = MAP_SCALE_FACTOR // <-- FIXED

  ;(scene as any).worldToTile = (wx: number, wy: number) => ({
    x: Math.floor(wx / (tileW * scale)),
    y: Math.floor(wy / (tileH * scale)),
  })
  ;(scene as any).tileToWorld = (tx: number, ty: number) => ({
    x: tx * tileW * scale + (tileW * scale) / 2,
    y: ty * tileH * scale + (tileH * scale) / 2,
  })

  // quick walkable check for a tile
  ;(scene as any).isWalkableTile = (tx: number, ty: number) =>
    tx >= 0 &&
    ty >= 0 &&
    ty < grid.length &&
    tx < grid[0].length &&
    grid[ty][tx] === 0

  // path request wrapper
  ;(scene as any).findPathTiles = (
    sx: number,
    sy: number,
    ex: number,
    ey: number
  ) =>
    new Promise<{ x: number; y: number }[]>((resolve) => {
      easystar.findPath(sx, sy, ex, ey, (path) => resolve(path || []))
    })

  return grid
}
