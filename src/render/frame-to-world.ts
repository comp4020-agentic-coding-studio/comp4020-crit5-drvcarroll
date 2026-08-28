// Game (x, y) maps to world (x, 0, -y): frame space's +y (up) becomes
// Three space's -z (into the screen), per BUILD_PLAN.md §2.1.
export function toWorld(gameX: number, gameY: number): [number, number] {
  return [gameX, -gameY];
}
