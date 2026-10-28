import { describe, expect, it } from 'vitest';
import { architect } from '../../../config/architect';
import { LAYERS, deriveBuilding, planOffset, type Box } from './params';
import { CUT_HEIGHT, area, contains, cutPieces, levelHeights, type Rect } from './plan';

const { plan, site } = architect.building;
const full = deriveBuilding(architect.building, 'full');
const low = deriveBuilding(architect.building, 'low');

const inside = (box: Box, bounds: Box) =>
  box.min.every((value, axis) => value >= bounds.min[axis] - 1e-9) &&
  box.max.every((value, axis) => value <= bounds.max[axis] + 1e-9);

describe('deriveBuilding', () => {
  it('fills the four exploded layers in order', () => {
    expect(LAYERS).toEqual(['estructura', 'envolvente', 'luz', 'habitar']);
    for (const layer of LAYERS) expect(full.parts.some((part) => part.layer === layer)).toBe(true);
  });

  it('uses concrete, wood and glass so each material wave has something to cover', () => {
    for (const kind of ['concrete', 'wood', 'glass'] as const) {
      expect(full.parts.some((part) => part.kind === kind)).toBe(true);
    }
  });

  it('gives every part a positive size', () => {
    for (const part of full.parts) {
      part.box.min.forEach((value, axis) => expect(part.box.max[axis]).toBeGreaterThan(value));
    }
  });

  it('keeps the whole building on the site', () => {
    const bounds: Box = {
      min: [-site.width / 2, 0, -site.depth / 2],
      max: [site.width / 2, full.height, site.depth / 2],
    };
    for (const part of full.parts) expect(inside(part.box, bounds)).toBe(true);
  });

  it('cantilevers the upper bar past the base', () => {
    const [base, upper] = full.volumes;
    expect(upper.max[0] - base.max[0]).toBeGreaterThan(3);
    expect(upper.min[1]).toBeCloseTo(base.max[1], 10);
  });

  it('is as tall as the blade wall', () => {
    expect(full.height).toBe(plan.blade.height);
  });

  it('draws fewer parts in the low-detail tier', () => {
    expect(low.parts.length).toBeLessThan(full.parts.length);
  });

  it('raises every wall exactly where its plan cuts it', () => {
    const offset = planOffset(plan);
    for (const id of ['ground', 'upper'] as const) {
      const { floor, ceiling } = levelHeights(plan, id);
      const y = floor + CUT_HEIGHT;
      const cut: Rect[] = plan[id].walls.flatMap((wall) => cutPieces(wall, plan, ceiling - floor));
      const built: Rect[] = full.parts
        .filter((part) => part.layer === 'envolvente' && part.box.min[1] <= y && part.box.max[1] >= y && part.box.max[1] <= ceiling + 1e-9)
        .map(({ box }) => ({ x: [box.min[0] - offset.x, box.max[0] - offset.x], z: [box.min[2] - offset.z, box.max[2] - offset.z] }));
      for (const rect of built) expect(cut.some((piece) => contains(piece, rect))).toBe(true);
      const sum = (rects: Rect[]) => rects.reduce((total, rect) => total + area(rect), 0);
      expect(sum(built)).toBeCloseTo(sum(cut), 6);
    }
  });

  it('stands a column under each one the plan draws, floor to ceiling', () => {
    const { floor, ceiling } = levelHeights(plan, 'ground');
    const columns = full.parts.filter((part) => part.layer === 'estructura' && part.box.min[1] === floor && part.box.max[1] === ceiling);
    expect(columns.length).toBe(plan.ground.columns.length);
  });

  it('sets the terrace a step below the upper floor, with a rail between its deck and the gravel', () => {
    const terraceFloor = plan.heights.ground - plan.terrace.drop;
    const decks = full.parts.filter((part) => part.layer === 'habitar' && part.kind === 'wood');
    expect(decks.length).toBe(plan.terrace.decks.length);
    for (const deck of decks) expect(deck.box.max[1]).toBeCloseTo(terraceFloor, 10);
    const rails = full.parts.filter((part) => part.layer === 'luz' && part.kind === 'glass' && part.box.min[1] === terraceFloor);
    expect(rails.length).toBe(plan.terrace.rails.length);
  });

  it('sketches vertical lines before horizontal ones, all over the site', () => {
    const firstHorizontal = full.sketch.findIndex((line) => line.direction === 'horizontal');
    expect(firstHorizontal).toBeGreaterThan(0);
    expect(full.sketch.slice(firstHorizontal).every((line) => line.direction === 'horizontal')).toBe(true);
    for (const line of full.sketch) {
      expect(Math.abs(line.from[0])).toBeLessThanOrEqual(site.width / 2 + 2);
      expect(Math.abs(line.to[2])).toBeLessThanOrEqual(site.depth / 2 + 2);
    }
  });

  it('measures each layer for the exploded view and its words', () => {
    for (const layer of LAYERS) {
      const bounds = full.layerBounds[layer];
      expect(bounds.max[1]).toBeGreaterThan(bounds.min[1]);
    }
  });
});
