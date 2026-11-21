// search.ts — a push-optimal A* over pushes.
//
// A state is the boxes (sorted) plus the player's reachable region, named by
// its lowest square: the player can walk anywhere in its region without
// pushing, so two states with the same boxes and the same region are the same
// state, whatever square the player happens to stand on. A move is one push:
// the player walks to the square behind a box (it must be in the region) and
// steps in, moving the box one square. Every push costs 1, so A* ordered by
// pushes made plus the assignment heuristic (heuristic.ts) meets the first
// solved state push-optimally — the heuristic is admissible and consistent,
// so no better solution exists past it.
//
// Prunes, all sound: a push landing on a square from which no box can reach
// a goal (live.ts), a frozen 2 x 2 block, a frozen box (deadlock.ts). The
// search is bounded by work, never the clock: at most maxStates states are
// stored, and the answer is the same on every run.

import { DIRS, walkTo, type Level } from './parse.ts';
import { liveSquares } from './live.ts';
import { frozenBlock, hasFrozenBox } from './deadlock.ts';
import { AssignmentHeuristic } from './heuristic.ts';

export interface SearchResult {
  pushes: number;
  moves: string;
  /** States stored (the work the search did). */
  states: number;
  /** States expanded. */
  expanded: number;
}

interface HeapEntry {
  f: number;
  g: number;
  seq: number;
  id: number;
}

export function solvePushOptimal(
  level: Level,
  maxStates: number,
  useHeuristic: boolean,
): SearchResult | null {
  const { w, wall, goals } = level;
  const size = wall.length;
  const goal = new Uint8Array(size);
  for (const g of goals) goal[g] = 1;
  const live = liveSquares(w, wall, goals);
  const heuristic = useHeuristic ? new AssignmentHeuristic(w, wall, goals) : null;
  const solved = (boxes: number[]): boolean => boxes.every((b) => goal[b] === 1);

  // Scratch buffers, reused so the hot loop allocates nothing: a stamp per
  // flood fill marks the player's region, and a stack walks it.
  const seen = new Int32Array(size);
  const stack = new Int32Array(size);
  let stamp = 0;
  const occupied = new Uint8Array(size);

  /** The lowest square of the region reachable from `from`, stamping it in `seen`. */
  const regionLow = (from: number): number => {
    const mark = ++stamp;
    let n = 0;
    let low = from;
    stack[n++] = from;
    seen[from] = mark;
    while (n > 0) {
      const p = stack[--n];
      if (p < low) low = p;
      const up = p - w;
      const down = p + w;
      const left = p - 1;
      const right = p + 1;
      if (wall[up] === 0 && occupied[up] === 0 && seen[up] !== mark) {
        seen[up] = mark;
        stack[n++] = up;
      }
      if (wall[down] === 0 && occupied[down] === 0 && seen[down] !== mark) {
        seen[down] = mark;
        stack[n++] = down;
      }
      if (wall[left] === 0 && occupied[left] === 0 && seen[left] !== mark) {
        seen[left] = mark;
        stack[n++] = left;
      }
      if (wall[right] === 0 && occupied[right] === 0 && seen[right] !== mark) {
        seen[right] = mark;
        stack[n++] = right;
      }
    }
    return low;
  };

  if (level.boxes.some((b) => !live[b])) return null;

  const keyOf = (boxes: number[], low: number): string => boxes.join(',') + '|' + low;

  // The states, in the order found: their boxes, the player's square, their
  // parent and the push that made them, and their key.
  const statesBoxes: number[][] = [level.boxes];
  const statesPlayer: number[] = [level.player];
  const parent: number[] = [-1];
  const pushBox: number[] = [-1];
  const pushDir: number[] = [-1];
  const stateKey: string[] = [];
  for (const b of level.boxes) occupied[b] = 1;
  const startLow = regionLow(level.player);
  for (const b of level.boxes) occupied[b] = 0;
  stateKey.push(keyOf(level.boxes, startLow));
  const best = new Map<string, number>([[stateKey[0]!, 0]]);

  if (solved(level.boxes)) return { pushes: 0, moves: '', states: 1, expanded: 0 };

  // The open list: a heap on (f, deeper first, insertion order). The
  // insertion order is a counter, so ties break the same way on every run.
  const heap: HeapEntry[] = [];
  let seq = 0;
  const h0 = heuristic === null ? 0 : heuristic.estimate(level.boxes);
  if (h0 === Infinity) return null;
  const less = (a: HeapEntry, b: HeapEntry): boolean =>
    a.f < b.f || (a.f === b.f && (a.g > b.g || (a.g === b.g && a.seq < b.seq)));
  const heapPush = (e: HeapEntry): void => {
    let i = heap.length;
    heap.push(e);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i]!, heap[p]!)) break;
      [heap[i], heap[p]] = [heap[p]!, heap[i]!];
      i = p;
    }
  };
  const heapPop = (): HeapEntry => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let i = 0; ; ) {
        let c = 2 * i + 1;
        if (c >= heap.length) break;
        if (c + 1 < heap.length && less(heap[c + 1]!, heap[c]!)) c++;
        if (!less(heap[c]!, heap[i]!)) break;
        [heap[i], heap[c]] = [heap[c]!, heap[i]!];
        i = c;
      }
    }
    return top;
  };
  heapPush({ f: h0, g: 0, seq: seq++, id: 0 });

  let expanded = 0;
  let found = -1;
  while (heap.length > 0) {
    const { g, id } = heapPop();
    if (best.get(stateKey[id]!) !== g) continue; // a better path to this state was found
    const boxes = statesBoxes[id]!;
    if (solved(boxes)) {
      found = id;
      break;
    }
    expanded++;
    const player = statesPlayer[id]!;
    for (const b of boxes) occupied[b] = 1;
    regionLow(player);
    const regionMark = stamp;
    // Phase one: collect every push the player can make from this region.
    // The region's stamps must be read before any successor's flood fill
    // overwrites them, so the pushes are gathered first, then applied.
    const candidates: { box: number; bi: number; di: number; t: number }[] = [];
    for (let bi = 0; bi < boxes.length; bi++) {
      const b = boxes[bi]!;
      for (let di = 0; di < 4; di++) {
        const [dx, dy] = DIRS[di]!;
        const d = dy * w + dx;
        const behind = b - d;
        const t = b + d;
        if (seen[behind] !== regionMark) continue; // the player cannot stand behind this box
        if (wall[t] || occupied[t] || !live[t]) continue;
        candidates.push({ box: b, bi, di, t });
      }
    }
    // Phase two: apply each push, prune the dead ones, and file the rest.
    for (const { box: b, bi, di, t } of candidates) {
      occupied[b] = 0;
      occupied[t] = 1;
      const frozen =
        frozenBlock(w, wall, occupied, goal, t) ||
        hasFrozenBox(w, wall, boxes.map((x, j) => (j === bi ? t : x)), goal);
      let next: number[] | null = null;
      let key = '';
      let h = 0;
      if (!frozen) {
        next = boxes.slice();
        next[bi] = t;
        next.sort((x, y) => x - y);
        h = heuristic === null ? 0 : heuristic.estimate(next);
        if (h !== Infinity) {
          const low = regionLow(b);
          key = keyOf(next, low);
        } else {
          next = null;
        }
      }
      occupied[t] = 0;
      occupied[b] = 1;
      if (next === null) continue;
      const ng = g + 1;
      const seenG = best.get(key);
      if (seenG !== undefined && seenG <= ng) continue;
      if (statesBoxes.length >= maxStates) {
        for (const x of boxes) occupied[x] = 0;
        return null;
      }
      best.set(key, ng);
      const nid = statesBoxes.length;
      statesBoxes.push(next);
      statesPlayer.push(b);
      parent.push(id);
      pushBox.push(b);
      pushDir.push(di);
      stateKey.push(key);
      heapPush({ f: ng + h, g: ng, seq: seq++, id: nid });
    }
    for (const x of boxes) occupied[x] = 0;
  }
  if (found < 0) return null;

  // The path of pushes, then the moves: walk to each push's square, then push.
  const path: number[] = [];
  for (let s = found; s > 0; s = parent[s]!) path.push(s);
  path.reverse();
  let moves = '';
  let player = level.player;
  let boxes = level.boxes;
  for (const s of path) {
    const nextBoxes = statesBoxes[s]!;
    const from = pushBox[s]!;
    const di = pushDir[s]!;
    const [dx, dy, , pushLetter] = DIRS[di]!;
    const d = dy * w + dx;
    for (const b of boxes) occupied[b] = 1;
    moves += walkTo(w, wall, occupied, player, from - d);
    for (const b of boxes) occupied[b] = 0;
    moves += pushLetter;
    player = from;
    boxes = nextBoxes;
  }
  return { pushes: path.length, moves, states: statesBoxes.length, expanded };
}
