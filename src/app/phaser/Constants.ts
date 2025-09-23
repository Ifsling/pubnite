export const MAP_SCALE_FACTOR = 1.4
export const COLLECTABLE_SPAWN_CHANCE = 0.07
export const NO_OF_ENEMIES = 10

export const ammoAmounts: { [key: string]: number } = {
  pistol: 15,
  ak47: 30,
  shotgun: 10,
  sniper: 5,
}

export const HEALERS_HEAL_AMOUNT = {
  ouchwrap: 25,
  healbox: 100,
}

export type PickupType =
  | "gun"
  | "helmet"
  | "vest"
  | "bagItem"
  | "ammo"
  | "sliptrap"
  | "faster-boi"

export const COLLECTABLES = [
  "ouchwrap",
  "healbox",
  "sliptrap",
  "faster-boi",
  "slowmo-injection",
  "boomnut",
]

export const houseEntryPoints = [
  [7, 5],
  [4, 8],
  [9, 7],
  [16, 5],
  [22, 7],
  [6, 12],
  [19, 9],
  [24, 8],
  [3, 17],
  [10, 17],
  [13, 17],
  [24, 15],
  [13, 21],
  [22, 19],
  [5, 23],
  [13, 27],
  [21, 23],
]
