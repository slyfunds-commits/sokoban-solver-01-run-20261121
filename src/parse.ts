// parse.ts — reading an XSB level into a grid.
//
// An XSB level is one row a line: '#' wall, ' ' floor, '.' goal, '$' box,
// '*' box on a goal, '@' player, '+' player on a goal. Short rows and the
// squares outside the text are walls; the outermost frame is a wall whatever
// it shows, so no index arithmetic ever walks off the board.

/** The four moves: [dx, dy, step letter, push letter]. */
export const DIRS: ReadonlyArray<readonly [number, number, string, string]> = [
  [0, -1, 'u', 'U'],
  [0, 1, 'd', 'D'],
  [-1, 0, 'l', 'L'],
  [1, 0, 'r', 'R'],
];

/** A level as flat arrays: index = y * w + x. */
export interface Level {
  w: number;
  h: number;
  /** 1 where a wall stands (including the frame and padded squares). */
  wall: Uint8Array;
  /** The goal squares, sorted ascending. */
  goals: number[];
  /** The box squares, sorted ascending. */
  boxes: number[];
  /** The player's square. */
  player: number;
}

export function parseLevel(text: string): Level {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const wall = new Uint8Array(w * h).fill(1);
  const goals: number[] = [];
  const boxes: number[] = [];
  let player = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const i = y * w + x;
      if (ch === '#') continue;
      wall[i] = 0;
      if (ch === '.' || ch === '*' || ch === '+') goals.push(i);
      if (ch === '$' || ch === '*') boxes.push(i);
      if (ch === '@' || ch === '+') player = i;
    }
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) wall[y * w + x] = 1;
    }
  }
  goals.sort((a, b) => a - b);
  boxes.sort((a, b) => a - b);
  return { w, h, wall, goals, boxes, player };
}

/** The squares the player reaches from `from`, walking around walls and boxes. */
export function reachableRegion(
  w: number,
  wall: Uint8Array,
  occupied: Uint8Array,
  from: number,
): { region: Uint8Array; lowest: number } {
  const region = new Uint8Array(wall.length);
  const stack = new Int32Array(wall.length);
  let n = 0;
  let lowest = from;
  stack[n++] = from;
  region[from] = 1;
  while (n > 0) {
    const p = stack[--n];
    if (p < lowest) lowest = p;
    const up = p - w;
    const down = p + w;
    const left = p - 1;
    const right = p + 1;
    if (wall[up] === 0 && occupied[up] === 0 && region[up] === 0) {
      region[up] = 1;
      stack[n++] = up;
    }
    if (wall[down] === 0 && occupied[down] === 0 && region[down] === 0) {
      region[down] = 1;
      stack[n++] = down;
    }
    if (wall[left] === 0 && occupied[left] === 0 && region[left] === 0) {
      region[left] = 1;
      stack[n++] = left;
    }
    if (wall[right] === 0 && occupied[right] === 0 && region[right] === 0) {
      region[right] = 1;
      stack[n++] = right;
    }
  }
  return { region, lowest };
}

/** The shortest walk from `from` to `to` around walls and boxes, in lower-case LURD. */
export function walkTo(
  w: number,
  wall: Uint8Array,
  occupied: Uint8Array,
  from: number,
  to: number,
): string {
  if (from === to) return '';
  const prev = new Int32Array(wall.length).fill(-1);
  const how = new Array<string>(wall.length);
  const queue = new Int32Array(wall.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = from;
  prev[from] = from;
  while (head < tail) {
    const p = queue[head++];
    if (p === to) break;
    for (const [dx, dy, letter] of DIRS) {
      const q = p + dy * w + dx;
      if (wall[q] || occupied[q] || prev[q] !== -1) continue;
      prev[q] = p;
      how[q] = letter;
      queue[tail++] = q;
    }
  }
  if (prev[to] === -1) throw new Error('walkTo: the push square is out of reach');
  let s = '';
  for (let p = to; p !== from; p = prev[p]!) s = how[p]! + s;
  return s;
}

/** The square the player stands on after `moves` (case ignored) from `from`. */
export function endOf(w: number, from: number, moves: string): number {
  let p = from;
  for (const ch of moves.toLowerCase()) {
    p += ch === 'u' ? -w : ch === 'd' ? w : ch === 'l' ? -1 : 1;
  }
  return p;
}
