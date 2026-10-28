import { describe, expect, it } from 'vitest';
import { planDrawing, sheetOffset } from '../scripts/experience/building/plan';
import {
  areaMatches,
  clearHeights,
  labelsInRooms,
  leavesClear,
  levelsOf,
  notesApart,
  onSheet,
  onSlab,
  openingsFit,
  solidsApart,
  stairComfort,
} from '../scripts/experience/building/planChecks';
import { sheetLayout } from '../scripts/experience/building/planSheet';
import { projects } from './projects';

/*
 * The rules every project's plan must pass before it is drafted beside the
 * main house: the same checks the main house passes (planChecks.ts), each
 * test named after the project so a failure says which house. The sheet is
 * framed on the project's plot exactly as the side slide frames it.
 */

describe('the plans of the other projects', () => {
  for (const { id, plan, site, area } of projects) {
    const { frame } = sheetLayout(plan, site, sheetOffset(plan), 1);
    const sheets = () => levelsOf(plan).map((level) => ({ level, drawing: planDrawing(plan, frame, level) }));

    it(`${id}: walls and columns of each level stand apart`, () => {
      expect(solidsApart(plan)).toEqual([]);
    });

    it(`${id}: every wall, column, stair and room stands on its slab and inside its footprint`, () => {
      expect(onSlab(plan)).toEqual([]);
    });

    it(`${id}: every opening fits inside its wall, with no two sharing a span`, () => {
      expect(openingsFit(plan)).toEqual([]);
    });

    it(`${id}: every door leaf swings clear of the other walls`, () => {
      expect(leavesClear(plan)).toEqual([]);
    });

    it(`${id}: an upper floor is reached by a comfortable stair under an open well`, () => {
      expect(stairComfort(plan)).toEqual([]);
    });

    it(`${id}: every level has at least 2.60 m clear`, () => {
      expect(clearHeights(plan)).toEqual([]);
    });

    it(`${id}: each level's sheet is drawn`, () => {
      expect(() => sheets()).not.toThrow();
    });

    it(`${id}: every room is lettered inside its rect, clear of its fittings and door swings`, () => {
      expect(sheets().flatMap(({ level, drawing }) => labelsInRooms(plan[level]!, drawing).map((problem) => `${level}: ${problem}`))).toEqual([]);
    });

    it(`${id}: no two notes are lettered over each other`, () => {
      expect(sheets().flatMap(({ level, drawing }) => notesApart(drawing).map((problem) => `${level}: ${problem}`))).toEqual([]);
    });

    it(`${id}: the whole drawing stays on its plot's sheet`, () => {
      expect(sheets().flatMap(({ level, drawing }) => onSheet(drawing, frame.sheet).map((problem) => `${level}: ${problem}`))).toEqual([]);
    });

    it(`${id}: the stated area is within 10% of the area its plan covers`, () => {
      expect(areaMatches(area, plan)).toEqual([]);
    });
  }
});
