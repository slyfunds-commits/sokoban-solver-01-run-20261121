# Sokoban solver — push-optimal, room by room

A solver for make.fun's `sokoban-solver-01` bounty: given a set of Sokoban
levels, it writes the player's moves that push every box onto a goal in as
few pushes as possible.

## The idea

Every level is a one-square-wide hallway with rooms off it, each room holding
3–4 boxes and as many goals, opening through a single door. A box pushed
through a door into the hallway can never come back, so every box stays in
its room — and the level's push-optimal count is the sum of its rooms'
optima. A search over the whole level would meet the product of the rooms'
positions; solving each room on its own meets only their sum.

The solver therefore:

1. **Cuts the level into rooms** (`src/rooms.ts`): the hallway's dead
   squares — open floor on the player's row from which no box can reach a
   goal — are cut out of the floor, and each connected part left that holds a
   box is a room, with its own boxes and goals. The cut is found from the
   board itself, not from the generator's layout.
2. **Solves each room push-optimally** (`src/search.ts`): an A* over pushes.
   A state is the boxes plus the player's reachable region (named by its
   lowest square); a move is one push. The heuristic is the minimum-cost
   assignment of boxes to goals by lone-box push distance (`src/heuristic.ts`,
   `src/live.ts`), which never overestimates, so the first solved state met
   is push-optimal.
3. **Prunes dead positions, soundly** (`src/live.ts`, `src/deadlock.ts`): a
   push landing where no box can reach a goal, a frozen 2×2 block of walls
   and boxes, and a box frozen on both axes. None of these ever rejects a
   solvable position.
4. **Joins the rooms** (`src/solve.ts`): while one room is solved, every
   other room's boxes stand as walls, and the player walks on from where the
   last room left it. If a room's search gives up within its state budget,
   it is retried as plain breadth-first over pushes before being left
   unsolved.

## Budgeting

The whole set shares one 60-second wall budget, so the solver budgets by
work, never by the clock: each room's search stores at most 300,000 states.
Nothing reads the clock, the environment, or any file outside `/input`, so
two runs answer byte for byte alike.

## Layout

- `main.ts` — reads `/input/<id>/level.txt`, writes
  `/output/<id>/solution.txt` (LURD moves, lower-case steps, upper-case
  pushes).
- `src/parse.ts` — XSB parsing, flood-fill reachability, shortest walks.
- `src/live.ts` — live squares and lone-box push distances (pull-back from
  the goals).
- `src/deadlock.ts` — frozen-block and frozen-box pruning.
- `src/heuristic.ts` — minimum-assignment heuristic, memoised.
- `src/search.ts` — the push-optimal A*.
- `src/rooms.ts` — room decomposition.
- `src/solve.ts` — room-by-room orchestration.

## Local run

```sh
mkdir -p out
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Node 22+, no dependencies, no network. The practice set is in the kit
(`practice/input`, references under `practice/reference`); score with the
kit's scorer (`program/scorer/score.ts`).

## License

MIT. Written from scratch for this bounty.
