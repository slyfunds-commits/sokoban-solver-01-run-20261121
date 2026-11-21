// heuristic.ts — how many pushes a position still needs, at least.
//
// For one box alone, the fewest pushes to a goal is its push distance
// (live.ts): a box must be pushed at least that far, whatever the other boxes
// do. Summing those distances over the best pairing of boxes to goals — the
// minimum-cost assignment — gives a lower bound on the pushes left, so it is
// an admissible heuristic: A* with it never overestimates, and the first
// solved state it meets is push-optimal.
//
// With three or four boxes the assignment is a handful of permutations
// (6 or 24), each a few table lookups, so it is computed exactly rather than
// approximated. Results are memoised on the boxes' key: the same box
// configuration is often reached with the player in different places.

import { pushDistances } from './live.ts';

/** All orderings of 0..n-1, built once. */
function permutations(n: number): number[][] {
  const out: number[][] = [];
  const used = new Array<boolean>(n).fill(false);
  const cur: number[] = [];
  const rec = (): void => {
    if (cur.length === n) {
      out.push(cur.slice());
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]!) continue;
      used[i] = true;
      cur.push(i);
      rec();
      cur.pop();
      used[i] = false;
    }
  };
  rec();
  return out;
}

export class AssignmentHeuristic {
  private readonly dist: Int32Array[];
  private readonly perms: number[][];
  private readonly cache = new Map<string, number>();

  constructor(
    w: number,
    wall: Uint8Array,
    goals: number[],
  ) {
    this.dist = pushDistances(w, wall, goals);
    this.perms = permutations(goals.length);
  }

  /** The minimum-assignment lower bound on pushes left, or Infinity when a box can reach no goal. */
  estimate(boxes: number[]): number {
    const key = boxes.join(',');
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    let best = Infinity;
    for (const perm of this.perms) {
      let sum = 0;
      for (let i = 0; i < boxes.length; i++) {
        const d = this.dist[perm[i]!]![boxes[i]!]!;
        if (d < 0) {
          sum = Infinity;
          break;
        }
        sum += d;
      }
      if (sum < best) best = sum;
    }
    this.cache.set(key, best);
    return best;
  }
}
