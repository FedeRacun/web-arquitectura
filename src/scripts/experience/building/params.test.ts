import { describe, expect, it } from 'vitest';
import { architect } from '../../../config/architect';
import { projects } from '../../../config/projects';
import { LAYERS, deriveBuilding, deriveModel, planOffset, type Box, type Part } from './params';
import { CUT_HEIGHT, area, contains, cutPieces, levelHeights, overlaps, sheetOffset, unionArea, type LevelId, type Rect } from './plan';

const { plan, site } = architect.building;
const full = deriveBuilding(architect.building, 'full');
const low = deriveBuilding(architect.building, 'low');

const inside = (box: Box, bounds: Box) =>
  box.min.every((value, axis) => value >= bounds.min[axis] - 1e-9) &&
  box.max.every((value, axis) => value <= bounds.max[axis] + 1e-9);

/** FNV-1a over every part to the nanometre: the same plan raises the same boxes, in the same order. */
function fingerprint(parts: readonly Part[]) {
  const text = parts.map(({ layer, kind, box }) => [layer, kind, ...[...box.min, ...box.max].map((v) => v.toFixed(9))].join(',')).join(';');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

describe('deriveBuilding', () => {
  it('raises the main house box for box as it did before any other house could be raised', () => {
    expect([full.parts.length, fingerprint(full.parts), low.parts.length, fingerprint(low.parts)]).toEqual([166, '9c0ba64f', 155, 'b43820d9']);
  });

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

  it('starts the second storey of the interior light where the upper floor is', () => {
    expect(full.storey).toBe(levelHeights(plan, 'upper').floor);
  });

  it('builds the blade into the house: no other part runs into it', () => {
    const blade = full.volumes[2];
    const into = (b: Box) => [0, 1, 2].every((axis) => Math.min(b.max[axis], blade.max[axis]) - Math.max(b.min[axis], blade.min[axis]) > 1e-6);
    const isBlade = (b: Box) => [0, 1, 2].every((axis) => b.min[axis] === blade.min[axis] && b.max[axis] === blade.max[axis]);
    expect(full.parts.filter((part) => isBlade(part.box))).toHaveLength(1);
    expect(full.parts.filter((part) => !isBlade(part.box) && into(part.box))).toEqual([]);
  });

  it('casts the canopy over the front door as thick as the terrace floor beside it', () => {
    const offset = planOffset(plan);
    const canopy = full.parts.filter(({ box }) => box.min[0] === plan.canopy.x[0] + offset.x && box.max[2] === plan.canopy.z[1] + offset.z);
    expect(canopy.length).toBe(1);
    expect(canopy[0].box.min[1]).toBeCloseTo(plan.heights.ground - plan.heights.slab, 10);
    expect(canopy[0].box.max[1]).toBeCloseTo(plan.heights.ground - plan.terrace.drop, 10);
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

describe('deriveModel', () => {
  const raised = projects.map((project) => {
    const offset = sheetOffset(project.plan);
    return { project, plan: project.plan, offset, model: deriveModel(project.plan, 'full', offset) };
  });
  const house = (id: string) => raised.find(({ project }) => project.id === id)!;
  /** A part's footprint back in its plan's coordinates. */
  const inPlan = (box: Box, offset: { x: number; z: number }): Rect => ({
    x: [box.min[0] - offset.x, box.max[0] - offset.x],
    z: [box.min[2] - offset.z, box.max[2] - offset.z],
  });
  /** Slabs and roofs: the flat concrete of the structure and the roof, no taller than a slab. */
  const flats = (parts: Part[], slab: number) =>
    parts.filter((part) => part.kind === 'concrete' && part.layer !== 'envolvente' && part.box.max[1] - part.box.min[1] <= slab + 1e-9);

  it('raises every other house, each part with a size, all of it on its sheet', () => {
    for (const { project, model } of raised) {
      expect(model.parts.length).toBeGreaterThan(0);
      const bounds: Box = {
        min: [-project.site.width / 2, 0, -project.site.depth / 2],
        max: [project.site.width / 2, model.height, project.site.depth / 2],
      };
      for (const part of model.parts) {
        part.box.min.forEach((value, axis) => expect(part.box.max[axis]).toBeGreaterThan(value));
        expect(inside(part.box, bounds)).toBe(true);
      }
    }
  });

  it('stands as tall as its storeys, or as its blade where that is taller', () => {
    for (const { plan, model } of raised) {
      const storeys = plan.heights.ground + (plan.upper ? plan.heights.upper! : 0);
      expect(model.height).toBe(Math.max(storeys, plan.blade?.height ?? 0));
    }
  });

  it('lays the ground slab on the footprint, open where the plan leaves a void', () => {
    for (const { plan, offset, model } of raised) {
      const slab = model.parts
        .filter((part) => part.layer === 'estructura' && part.box.min[1] === 0 && part.box.max[1] === plan.heights.slab)
        .map(({ box }) => inPlan(box, offset));
      const floor = plan.ground.footprint ?? [plan.ground.slab];
      for (const piece of slab) expect(floor.some((rect) => contains(rect, piece))).toBe(true);
      // These houses' voids lie inside their floors.
      expect(slab.reduce((sum, piece) => sum + area(piece), 0)).toBeCloseTo(unionArea(floor) - unionArea(plan.ground.voids ?? []), 6);
    }
  });

  it('roofs a one-storey house over its footprint and leaves the patio in the middle open to the sky', () => {
    const { plan, offset, model } = house('casa-patio');
    const patio: Rect = { x: [2.8, 12.1], z: [5.3, 13.7] };
    const roof = model.parts.filter((part) => part.layer === 'habitar' && part.box.max[1] === plan.heights.ground).map(({ box }) => inPlan(box, offset));
    expect(roof.reduce((sum, piece) => sum + area(piece), 0)).toBeCloseTo(unionArea(plan.ground.footprint!), 6);
    expect(flats(model.parts, plan.heights.slab).filter(({ box }) => overlaps(inPlan(box, offset), patio))).toEqual([]);
  });

  it('keeps the patio between party walls open to the sky, and roofs the stair well', () => {
    const { plan, offset, model } = house('casa-lote-angosto');
    const [stair, patio] = plan.upper!.voids!;
    const top = plan.heights.ground + plan.heights.upper!;
    expect(flats(model.parts, plan.heights.slab).filter(({ box }) => overlaps(inPlan(box, offset), patio))).toEqual([]);
    const roof = model.parts.filter((part) => part.layer === 'habitar' && part.box.max[1] === top).map(({ box }) => inPlan(box, offset));
    const shared = (a: Rect, b: Rect) =>
      Math.max(0, Math.min(a.x[1], b.x[1]) - Math.max(a.x[0], b.x[0])) * Math.max(0, Math.min(a.z[1], b.z[1]) - Math.max(a.z[0], b.z[0]));
    expect(roof.reduce((sum, piece) => sum + shared(piece, stair), 0)).toBeCloseTo(area(stair), 6);
  });

  it('roofs the ground floor the upper floor leaves uncovered at the upper floor\'s level', () => {
    const { plan, offset, model } = house('casa-lote-angosto');
    const street: Rect = { x: plan.ground.slab.x, z: [plan.ground.slab.z[0], plan.upper!.slab.z[0]] };
    const covers = model.parts.filter(
      ({ box }) => box.min[1] === plan.heights.ground - plan.heights.slab && box.max[1] === plan.heights.ground && contains(inPlan(box, offset), street),
    );
    expect(covers.length).toBe(1);
  });

  it('builds the blade into the house: no other part runs into it', () => {
    const { plan, offset, model } = house('casa-en-l');
    const blade = plan.blade!;
    const runsInto = (box: Box) =>
      overlaps(inPlan(box, offset), blade) && box.min[1] < blade.height - 1e-6 && box.max[1] > 1e-6;
    const into = model.parts.filter(({ box }) => runsInto(box) && !(contains(inPlan(box, offset), blade) && contains(blade, inPlan(box, offset))));
    expect(into).toEqual([]);
  });

  it('raises every wall of every floor exactly where its plan cuts it', () => {
    for (const { plan, offset, model } of raised) {
      const levels: LevelId[] = plan.upper ? ['ground', 'upper'] : ['ground'];
      for (const id of levels) {
        const { floor, ceiling } = levelHeights(plan, id);
        const y = floor + CUT_HEIGHT;
        const cut = plan[id]!.walls.flatMap((wall) => cutPieces(wall, plan, ceiling - floor));
        const built = model.parts
          .filter((part) => part.layer === 'envolvente' && part.box.min[1] <= y && part.box.max[1] >= y && part.box.max[1] <= ceiling + 1e-9)
          .map(({ box }) => inPlan(box, offset));
        for (const rect of built) expect(cut.some((piece) => contains(piece, rect))).toBe(true);
        const sum = (rects: Rect[]) => rects.reduce((total, rect) => total + area(rect), 0);
        expect(sum(built)).toBeCloseTo(sum(cut), 6);
      }
    }
  });
});
