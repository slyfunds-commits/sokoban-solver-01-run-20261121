// solve.ts — solving a level room by room.
//
// The level's push-optimal count is the sum of its rooms' optima, so each
// room is solved on its own with a push-optimal search and the moves are
// joined with the walks between rooms. While one room is solved, every other
// room's boxes stand as walls (on their goals once their room is done), so
// the search never spends a state on another room's problem. The player walks
// on from where the last room left it: the generator guarantees a finished
// room never shuts the player in, so the walk out through its door is always
// there.
//
// When a level is no set of rooms, the whole level is searched instead. When
// a room's search gives up within its state budget, the search is retried
// without the heuristic — plain breadth-first over pushes — before the room
// is left unsolved. A room left unsolved keeps the level unsolved, so the
// moves written are the rooms that were solved, in order, which is still a
// legal replay.

import { endOf, type Level } from './parse.ts';
import { roomsOf, type Room } from './rooms.ts';
import { solvePushOptimal, type SearchResult } from './search.ts';

/** The states one room's search may store, per attempt, before it gives up. */
export const MAX_STATES_PER_ROOM = 300_000;

export interface LevelResult {
  /** The concatenated moves (lower-case steps, upper-case pushes). */
  moves: string;
  /** The pushes the solution makes. */
  pushes: number;
  /** Whether every room was solved. */
  solved: boolean;
  /** The states each room's search stored, in room order. */
  statesPerRoom: number[];
}

/** One room solved on its own, the other rooms' boxes standing as walls. */
function solveRoom(
  level: Level,
  room: Room,
  rooms: Room[],
  done: boolean[],
  player: number,
): SearchResult | null {
  const wall = level.wall.slice();
  for (let i = 0; i < rooms.length; i++) {
    if (rooms[i] === room) continue;
    const other = rooms[i]!;
    // A finished room's boxes sit on its goals; an unfinished room's boxes
    // sit where the level put them. Either way they are walls for this room.
    for (const b of done[i]! ? other.goals : other.boxes) wall[b] = 1;
  }
  const sub: Level = {
    w: level.w,
    h: level.h,
    wall,
    goals: room.goals.slice().sort((a, b) => a - b),
    boxes: room.boxes.slice().sort((a, b) => a - b),
    player,
  };
  return (
    solvePushOptimal(sub, MAX_STATES_PER_ROOM, true) ??
    solvePushOptimal(sub, MAX_STATES_PER_ROOM, false)
  );
}

export function solveLevel(level: Level): LevelResult {
  const rooms = roomsOf(level);
  if (rooms === null) {
    const whole =
      solvePushOptimal(level, MAX_STATES_PER_ROOM, true) ??
      solvePushOptimal(level, MAX_STATES_PER_ROOM, false);
    if (whole === null) return { moves: '', pushes: 0, solved: false, statesPerRoom: [] };
    return { moves: whole.moves, pushes: whole.pushes, solved: true, statesPerRoom: [whole.states] };
  }
  let player = level.player;
  let moves = '';
  let pushes = 0;
  const statesPerRoom: number[] = [];
  const done = rooms.map(() => false);
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i]!;
    const solved = solveRoom(level, room, rooms, done, player);
    if (solved === null) {
      return { moves, pushes, solved: false, statesPerRoom };
    }
    statesPerRoom.push(solved.states);
    moves += solved.moves;
    pushes += solved.pushes;
    player = endOf(level.w, player, solved.moves);
    done[i] = true;
  }
  return { moves, pushes, solved: true, statesPerRoom };
}
