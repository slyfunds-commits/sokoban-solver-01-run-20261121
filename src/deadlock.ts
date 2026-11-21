// deadlock.ts — positions no push can ever save.
//
// Two prunes, both sound (neither ever rejects a solvable position):
//
// 1. A frozen 2 x 2 block: four squares of walls and boxes, at least one of
//    them a box off its goal. None of those boxes can ever move — each is
//    hemmed in on both axes by the block — so the position is dead.
// 2. A frozen box: a box that cannot move along either axis. "Cannot move
//    along x" means both neighbours on x are walls or boxes that are
//    themselves frozen along x, and likewise for y. The freeze spreads from
//    the walls inward to a fixpoint; a box frozen on both axes, off its goal,
//    can never be pushed again.
//
// The live-squares table (live.ts) already prunes corner and wall-segment
// deadlocks; these two catch the ones it cannot see, where boxes jam each
// other.

/** Whether the box just pushed to `t` sits in a frozen 2 x 2 block. */
export function frozenBlock(
  w: number,
  wall: Uint8Array,
  occupied: Uint8Array,
  goal: Uint8Array,
  t: number,
): boolean {
  for (const a of [t, t - 1, t - w, t - w - 1]) {
    const b = a + 1;
    const c = a + w;
    const d = c + 1;
    if (!(wall[a] || occupied[a])) continue;
    if (!(wall[b] || occupied[b])) continue;
    if (!(wall[c] || occupied[c])) continue;
    if (!(wall[d] || occupied[d])) continue;
    if (
      (occupied[a] && !goal[a]) ||
      (occupied[b] && !goal[b]) ||
      (occupied[c] && !goal[c]) ||
      (occupied[d] && !goal[d])
    ) {
      return true;
    }
  }
  return false;
}

/**
 * The boxes frozen in place: each entry true when that box can move along
 * neither axis. A box on a goal is never reported frozen — it is already
 * where it belongs.
 */
export function frozenBoxes(
  w: number,
  wall: Uint8Array,
  boxes: number[],
  goal: Uint8Array,
): boolean[] {
  const at = new Map<number, number>();
  boxes.forEach((b, i) => at.set(b, i));
  // Nothing is assumed frozen: the freeze spreads from the walls alone, to a
  // fixpoint. A box on a goal counts as a blocker only once the fixpoint
  // proves it cannot move either — never by assumption.
  const frozen = boxes.map(() => false);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < boxes.length; i++) {
      if (frozen[i]!) continue;
      const b = boxes[i]!;
      const blocked = (s: number): boolean => {
        if (wall[s]) return true;
        const j = at.get(s);
        return j !== undefined && frozen[j] === true;
      };
      const frozenX = blocked(b - 1) && blocked(b + 1);
      const frozenY = blocked(b - w) && blocked(b + w);
      if (frozenX && frozenY) {
        frozen[i] = true;
        changed = true;
      }
    }
  }
  // A frozen box on its goal is already solved; only a frozen box off its
  // goal is a deadlock.
  return boxes.map((b, i) => (goal[b] ? false : frozen[i]!));
}

/** Whether any box off its goal is frozen in place. */
export function hasFrozenBox(
  w: number,
  wall: Uint8Array,
  boxes: number[],
  goal: Uint8Array,
): boolean {
  return frozenBoxes(w, wall, boxes, goal).some((f) => f);
}
