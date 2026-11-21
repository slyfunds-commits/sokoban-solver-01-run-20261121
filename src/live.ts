// live.ts — which squares a box can ever leave, and how far a lone box is from each goal.
//
// Both tables come from the same pull-back idea: a box can be pushed from y to
// x (in direction d, so y = x - d) exactly when y is open floor and the player
// can stand at y - d. Walking that backwards from the goals marks every square
// a box could ever be pushed from on its way to a goal. A box on any other
// square is lost, and a push landing there is pruned before it is made.
//
// liveSquares marks those squares. pushDistances goes further and records, for
// each goal, the fewest pushes a lone box needs from every square to reach it
// (ignoring the other boxes): the exact single-box distance the assignment
// heuristic sums.

/**
 * The live squares of a board: 1 where a box can still be pushed onto some
 * goal. Computed by a breadth-first pull-back from the goals over open floor.
 */
export function liveSquares(
  w: number,
  wall: Uint8Array,
  goals: number[],
): Uint8Array {
  const live = new Uint8Array(wall.length);
  const queue = new Int32Array(wall.length);
  let head = 0;
  let tail = 0;
  for (const g of goals) {
    live[g] = 1;
    queue[tail++] = g;
  }
  while (head < tail) {
    const x = queue[head++];
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const d = dy * w + dx;
      const y = x - d;
      // A box at y is pushed to x when the player stands at y - d.
      if (wall[y] === 0 && wall[y - d] === 0 && live[y] === 0) {
        live[y] = 1;
        queue[tail++] = y;
      }
    }
  }
  return live;
}

/**
 * For each goal (in the order given), the fewest pushes a lone box needs from
 * every square to reach that goal, or -1 where no push path exists. Each
 * table is a breadth-first pull-back from its goal, the same walk as
 * liveSquares but counting pushes.
 */
export function pushDistances(
  w: number,
  wall: Uint8Array,
  goals: number[],
): Int32Array[] {
  return goals.map((goal) => {
    const dist = new Int32Array(wall.length).fill(-1);
    const queue = new Int32Array(wall.length);
    let head = 0;
    let tail = 0;
    dist[goal] = 0;
    queue[tail++] = goal;
    while (head < tail) {
      const x = queue[head++];
      const nx = dist[x]! + 1;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) {
        const d = dy * w + dx;
        const y = x - d;
        if (wall[y] === 0 && wall[y - d] === 0 && dist[y] === -1) {
          dist[y] = nx;
          queue[tail++] = y;
        }
      }
    }
    return dist;
  });
}
