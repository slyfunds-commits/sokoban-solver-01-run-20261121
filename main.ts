// main.ts — the entry's program: solve every level of a set, one run.
//
// Input: /input/<id>/level.txt for each instance <id> (MAKEFUN_INPUT_DIR
// outside the grader). Output: /output/<id>/solution.txt for each instance
// (MAKEFUN_OUTPUT_DIR outside the grader), the player's moves in LURD,
// lower-case steps and upper-case pushes, one line.
//
// The whole set shares one wall budget of 60 seconds, so the solver budgets
// by work, never by the clock: every search is capped in states stored, and
// nothing here reads the clock, the environment, or any file outside /input.
// The answer is therefore the same on every run, byte for byte.
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLevel } from './src/parse.ts';
import { solveLevel } from './src/solve.ts';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

for (const id of readdirSync(INPUT_DIR).sort()) {
  // An instance is a directory holding level.txt; anything else in /input is
  // not one of the set's instances.
  if (!lstatSync(join(INPUT_DIR, id)).isDirectory()) continue;
  const level = parseLevel(readFileSync(join(INPUT_DIR, id, 'level.txt'), 'utf8'));
  const result = solveLevel(level);
  mkdirSync(join(OUTPUT_DIR, id), { recursive: true });
  writeFileSync(join(OUTPUT_DIR, id, 'solution.txt'), `${result.moves}\n`);
}
