// rooms.ts — cutting a level into the independent rooms the generator built.
//
// A level is a one-square-wide hallway (the row the player starts on) with
// rooms off it, each opening through a single door. A box pushed through a
// door into the hallway can never come back, so in any optimal solution every
// box stays in its room and each room is a problem of its own.
//
// The cut is found from the board itself, not from the generator's layout: a
// square of the hallway is dead — a box there reaches no goal — so the
// hallway's dead squares are cut out of the floor, and each connected part
// left that holds a box is a room, with its own boxes and goals. The
// decomposition fails (null) when a box starts in the hallway, a goal falls
// outside every part, or a part's boxes and goals do not match; the caller
// then solves the whole level instead.

import { DIRS, type Level } from './parse.ts';
import { liveSquares } from './live.ts';

export interface Room {
  /** The room's floor squares, including its door square. */
  squares: number[];
  boxes: number[];
  goals: number[];
}

/**
 * The level's rooms, in order of their lowest square (the rooms above the
 * hallway before the rooms below it), or null when the level is no set of
 * rooms.
 */
export function roomsOf(level: Level): Room[] | null {
  const { w, wall, goals, boxes, player } = level;
  const live = liveSquares(w, wall, goals);
  const row = Math.floor(player / w);
  // The hallway's dead squares: open floor on the player's row from which no
  // box can reach a goal.
  const cut = new Uint8Array(wall.length);
  for (let i = row * w; i < (row + 1) * w; i++) {
    if (wall[i] === 0 && live[i] === 0) cut[i] = 1;
  }
  if (boxes.some((b) => cut[b])) return null;
  // The connected parts of the floor once the hallway is cut away.
  const part = new Int32Array(wall.length).fill(-1);
  const rooms: Room[] = [];
  for (let s = 0; s < wall.length; s++) {
    if (wall[s] || cut[s] || part[s] >= 0) continue;
    const squares = [s];
    part[s] = rooms.length;
    for (let i = 0; i < squares.length; i++) {
      for (const [dx, dy] of DIRS) {
        const q = squares[i]! + dy * w + dx;
        if (wall[q] === 0 && cut[q] === 0 && part[q] < 0) {
          part[q] = rooms.length;
          squares.push(q);
        }
      }
    }
    rooms.push({ squares, boxes: [], goals: [] });
  }
  for (const b of boxes) rooms[part[b]!]!.boxes.push(b);
  for (const g of goals) {
    if (part[g]! < 0) return null;
    rooms[part[g]!]!.goals.push(g);
  }
  if (rooms.some((r) => r.boxes.length !== r.goals.length)) return null;
  return rooms.filter((r) => r.boxes.length > 0);
}
