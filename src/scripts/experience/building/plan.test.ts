import { describe, expect, it } from 'vitest';
import { plan } from '../../../config/plan';
import {
  area,
  contains,
  cutPieces,
  doorSwing,
  labelBox,
  levelHeights,
  openingHeights,
  openingSpan,
  overlaps,
  planDrawing,
  runsAlongX,
  sheetBounds,
  sheetOffset,
  slice,
  stairGeometry,
  wallBlocks,
  type Level,
  type LevelId,
  type Opening,
  type Plan,
  type PlanDrawing,
  type Point,
  type Rect,
  type Room,
  type SheetPlan,
  type Wall,
} from './plan';
import { planOffset } from './params';

const LEVELS: LevelId[] = ['ground', 'upper'];

/**
 * A one-storey house with none of the main house's extras: no upper floor,
 * no blade, no canopy, no galería, no terrace. Load-bearing concrete walls on
 * the two axes each way, brick partitions, and nothing drawn above the cut
 * (no high window, passage or stair), so any dashed line would be a part it
 * does not have.
 */
const cottage: SheetPlan = {
  heights: { slab: 0.3, structure: 0.2, ground: 3.2, door: 2.1 },
  column: 0.3,
  grid: {
    x: [
      { id: '1', at: 0.15 },
      { id: '2', at: 11.85 },
    ],
    z: [
      { id: 'A', at: 0.15 },
      { id: 'B', at: 7.85 },
    ],
  },
  ground: {
    name: 'Planta',
    slab: { x: [0, 12], z: [0, 8] },
    walls: [
      {
        kind: 'concrete',
        x: [0, 12],
        z: [0, 0.3],
        openings: [
          { type: 'door', at: 2, width: 0.95, hinge: 'min', side: 1 },
          { type: 'window', at: 4, width: 1.8, sill: 0.9, head: 2.1 },
          { type: 'window', at: 7.6, width: 1.2, sill: 0.9, head: 2.1 },
        ],
      },
      {
        kind: 'concrete',
        x: [0, 12],
        z: [7.7, 8],
        openings: [
          { type: 'slider', at: 1, width: 4.2, leaves: 2 },
          { type: 'window', at: 8.2, width: 2.4, sill: 0.9, head: 2.1 },
        ],
      },
      { kind: 'concrete', x: [0, 0.3], z: [0.3, 7.7], openings: [{ type: 'window', at: 0.8, width: 1.6, sill: 0.9, head: 2.1 }] },
      { kind: 'concrete', x: [11.7, 12], z: [0.3, 7.7], openings: [{ type: 'window', at: 1.6, width: 0.6, sill: 1, head: 2.1 }] },
      {
        kind: 'partition',
        x: [6.85, 7],
        z: [0.3, 7.7],
        openings: [
          { type: 'door', at: 1.2, width: 0.8, hinge: 'min', side: 1 },
          { type: 'door', at: 4.4, width: 0.8, hinge: 'min', side: 1 },
        ],
      },
      { kind: 'partition', x: [7, 11.7], z: [3.85, 4], openings: [{ type: 'door', at: 2.7, width: 0.7, hinge: 'min', side: -1 }] },
      { kind: 'partition', x: [9.35, 9.5], z: [0.3, 3.85] },
    ],
    columns: [],
    rooms: [
      { name: 'Estar comedor', rect: { x: [0.3, 6.85], z: [0.3, 7.7] }, label: [3.6, 3], npt: true },
      { name: 'Cocina', rect: { x: [7, 9.35], z: [0.3, 3.85] }, label: [8.4, 2.6] },
      { name: 'Baño', rect: { x: [9.5, 11.7], z: [0.3, 3.85] }, label: [10.9, 2.6] },
      { name: 'Dormitorio', rect: { x: [7, 11.7], z: [4, 7.7] }, label: [8.4, 6.6] },
    ],
    fixtures: [
      { kind: 'sofa', rect: { x: [0.6, 1.5], z: [3.4, 5.6] }, facing: 'e' },
      { kind: 'table', rect: { x: [3.6, 5.4], z: [5.6, 6.6] }, facing: 'n', seats: 2 },
      { kind: 'counter', rect: { x: [7, 9.35], z: [0.3, 0.9] }, facing: 'n' },
      { kind: 'sink', rect: { x: [7.9, 8.6], z: [0.38, 0.82] }, facing: 'n' },
      { kind: 'cooktop', rect: { x: [8.75, 9.3], z: [0.35, 0.85] }, facing: 'n' },
      { kind: 'basin', rect: { x: [9.7, 10.3], z: [0.3, 0.75] }, facing: 'n' },
      { kind: 'shower', rect: { x: [10.8, 11.7], z: [0.3, 1.2] }, facing: 'n' },
      { kind: 'wc', rect: { x: [9.5, 10.15], z: [1.45, 1.85] }, facing: 'e' },
      { kind: 'wardrobe', rect: { x: [7.3, 9.3], z: [4, 4.6] }, facing: 'n' },
      { kind: 'bed', rect: { x: [9.6, 11.7], z: [4.95, 6.55] }, facing: 'w' },
    ],
  },
};
/** The cottage centred on an 18 × 14 m plot. */
const cottageFrame = { bounds: { x: [0, 12], z: [0, 8] }, sheet: { x: [-3, 15], z: [-3, 11] } } satisfies { bounds: Rect; sheet: Rect };
const clearOf = (id: LevelId) => {
  const { floor, ceiling } = levelHeights(plan, id);
  return ceiling - floor;
};
const columnRects = (id: LevelId): Rect[] =>
  plan[id].columns.map(([x, z]) => ({ x: [x - plan.column / 2, x + plan.column / 2], z: [z - plan.column / 2, z + plan.column / 2] }));

describe('the plan data', () => {
  it('keeps every wall and column of a level apart, so no two solids overlap', () => {
    for (const id of LEVELS) {
      const solids: Rect[] = [...plan[id].walls, ...columnRects(id)];
      for (let i = 0; i < solids.length; i++) {
        for (let j = i + 1; j < solids.length; j++) expect(overlaps(solids[i], solids[j]), `${id} ${i}/${j}`).toBe(false);
      }
    }
  });

  it('keeps every wall, column, room and stair on its slab', () => {
    for (const id of LEVELS) {
      const level = plan[id];
      for (const rect of [...level.walls, ...columnRects(id), ...(level.stair ? [level.stair] : [])]) {
        expect(contains(level.slab, rect)).toBe(true);
      }
      for (const room of level.rooms) {
        const under = room.semicovered ? plan.upper.slab : level.slab;
        expect(contains(under, room.rect), room.name).toBe(true);
      }
    }
  });

  it('fits every opening inside its wall without two openings sharing a span', () => {
    for (const id of LEVELS) {
      for (const wall of plan[id].walls) {
        const run = runsAlongX(wall) ? wall.x : wall.z;
        const spans = (wall.openings ?? []).map((opening) => openingSpan(wall, opening)).sort((a, b) => a[0] - b[0]);
        spans.forEach(([a, b], i) => {
          expect(a).toBeGreaterThanOrEqual(run[0] - 1e-9);
          expect(b).toBeLessThanOrEqual(run[1] + 1e-9);
          if (i > 0) expect(a).toBeGreaterThanOrEqual(spans[i - 1][1] - 1e-9);
        });
        for (const opening of wall.openings ?? []) {
          const [bottom, top] = openingHeights(opening, plan, clearOf(id));
          expect(top).toBeGreaterThan(bottom);
          expect(top).toBeLessThanOrEqual(clearOf(id) + 1e-9);
        }
      }
    }
  });

  it('swings every door leaf clear of the other walls', () => {
    for (const id of LEVELS) {
      const walls = plan[id].walls;
      for (const wall of walls) {
        for (const opening of wall.openings ?? []) {
          if (opening.type !== 'door') continue;
          const { hinge, tip } = doorSwing(wall, opening);
          const leaf: Rect = {
            x: [Math.min(hinge[0], tip[0]) - 0.01, Math.max(hinge[0], tip[0]) + 0.01],
            z: [Math.min(hinge[1], tip[1]) - 0.01, Math.max(hinge[1], tip[1]) + 0.01],
          };
          for (const other of walls) {
            if (other === wall) continue;
            expect(overlaps(leaf, other), `${id} door at ${opening.at}`).toBe(false);
          }
        }
      }
    }
  });

  it('climbs one storey in comfortable steps, under an open stair well', () => {
    const stair = plan.ground.stair!;
    const floorToFloor = levelHeights(plan, 'upper').floor - levelHeights(plan, 'ground').floor;
    const steps = stairGeometry(stair, floorToFloor);
    expect(steps.rise * stair.risers).toBeCloseTo(floorToFloor, 10);
    expect(steps.rise).toBeLessThanOrEqual(0.18);
    expect(steps.tread).toBeGreaterThanOrEqual(0.27);
    expect(steps.blondel).toBeGreaterThanOrEqual(0.6);
    expect(steps.blondel).toBeLessThanOrEqual(0.65);
    expect((plan.upper.voids ?? []).some((well) => contains(well, { x: stair.x, z: stair.z }))).toBe(true);
  });

  it('gives each floor a slab with room for its build-up, without changing the storey height or the stair', () => {
    const { slab, structure } = plan.heights;
    expect(slab - structure).toBeGreaterThanOrEqual(0.1);
    const ground = levelHeights(plan, 'ground');
    const upper = levelHeights(plan, 'upper');
    expect(upper.floor - ground.floor).toBeCloseTo(3.35, 10);
    for (const level of [ground, upper]) expect(level.ceiling - level.floor).toBeGreaterThanOrEqual(2.6);
  });

  it('stacks the upper floor on the ground floor and cantilevers it past the east wall', () => {
    expect(plan.upper.slab.x[0]).toBeGreaterThan(plan.ground.slab.x[0]);
    expect(plan.upper.slab.x[1] - plan.ground.slab.x[1]).toBeGreaterThan(3);
  });

  it("sets the cantilever's east glass 0.90 m back, framed by the bar's long walls and its slabs", () => {
    const { slab, walls, rooms, fixtures } = plan.upper;
    const end = slab.x[1];
    const glazed = walls.filter((wall) => !runsAlongX(wall) && wall.openings?.some((opening) => opening.type === 'glass'));
    expect(glazed).toHaveLength(1);
    const [glass] = glazed;
    expect(end - glass.x[1]).toBeCloseTo(0.9, 10);
    const sides = walls.filter((wall) => runsAlongX(wall) && wall.kind === 'concrete' && wall.x[1] === end);
    expect(sides).toHaveLength(2);
    expect(Math.min(...sides.map((wall) => wall.z[0]))).toBeLessThan(glass.z[0]);
    expect(Math.max(...sides.map((wall) => wall.z[1]))).toBeGreaterThan(glass.z[1]);
    for (const wall of walls.filter((wall) => !sides.includes(wall))) expect(wall.x[1]).toBeLessThanOrEqual(glass.x[1]);
    for (const { rect } of [...rooms, ...fixtures]) expect(rect.x[1]).toBeLessThanOrEqual(glass.x[0]);
  });

  it('closes the west side with the blade: flush with the ground floor, past both its ends, up to the roof', () => {
    const { blade, ground, heights } = plan;
    expect(blade.x[0]).toBe(ground.slab.x[0]);
    expect(blade.z[0]).toBeLessThan(ground.slab.z[0]);
    expect(blade.z[1]).toBeGreaterThan(ground.slab.z[1]);
    expect(blade.height).toBeCloseTo(heights.ground + heights.upper, 10);
    for (const rect of [...plan.ground.walls, ...plan.upper.walls, ...plan.terrace.parapets]) expect(overlaps(rect, blade)).toBe(false);
  });

  it("covers the front door with a canopy carried by the blade's south wing", () => {
    const { blade, canopy, ground } = plan;
    expect(canopy.x[0]).toBe(blade.x[1]);
    expect(canopy.z[0]).toBeGreaterThanOrEqual(blade.z[0]);
    expect(canopy.z[1]).toBe(ground.slab.z[0]);
    const street = ground.walls.find((wall) => runsAlongX(wall) && wall.z[0] === ground.slab.z[0])!;
    const door = street.openings!.find((opening) => opening.type === 'door')!;
    const [a, b] = openingSpan(street, door);
    expect(a).toBeGreaterThanOrEqual(canopy.x[0]);
    expect(b).toBeLessThanOrEqual(canopy.x[1]);
  });
});

describe('cutting a wall', () => {
  const wall: Wall = {
    kind: 'concrete',
    x: [0, 10],
    z: [0, 0.3],
    openings: [
      { type: 'door', at: 1, width: 1, hinge: 'min', side: 1 },
      { type: 'window', at: 4, width: 2, sill: 1, head: 2.1 },
      { type: 'window', at: 7, width: 1, sill: 1.6, head: 2.1 },
    ],
  };
  const fakePlan = { ...plan, heights: { ...plan.heights, door: 2.1 } } as Plan;

  it('keeps as poché what is solid at 1.20 m: a high window stays in the wall', () => {
    const pieces = cutPieces(wall, fakePlan, 3);
    expect(pieces.map((piece) => piece.x)).toEqual([
      [0, 1],
      [2, 4],
      [6, 10],
    ]);
  });

  it('builds the full-height runs and the sills and lintels around each opening', () => {
    const blocks = wallBlocks(wall, fakePlan, 3);
    const volume = blocks.reduce((sum, block) => sum + area(block.rect) * (block.y[1] - block.y[0]), 0);
    const openings = 1 * 2.1 + 2 * 1.1 + 1 * 0.5;
    expect(volume).toBeCloseTo((10 * 3 - openings) * 0.3, 10);
  });

  it('slices along the wall it runs with', () => {
    expect(slice({ x: [0, 0.3], z: [0, 5] }, 1, 2)).toEqual({ x: [0, 0.3], z: [1, 2] });
  });
});

describe('the drawn plan', () => {
  const frame = {
    bounds: { x: [plan.blade.x[0], plan.upper.slab.x[1]], z: [plan.ground.slab.z[0], plan.ground.slab.z[1]] },
    sheet: { x: [-2.2, 23.8], z: [-3.9, 14.1] },
  } satisfies { bounds: Rect; sheet: Rect };
  const drawing = planDrawing(plan, frame);

  it('fills every concrete wall, the columns and the blade as poché, and hatches the partitions', () => {
    const concrete = plan.ground.walls.filter((wall) => wall.kind === 'concrete');
    const partitions = plan.ground.walls.filter((wall) => wall.kind === 'partition');
    const cut = (walls: readonly Wall[]) => walls.flatMap((wall) => cutPieces(wall, plan, clearOf('ground')));
    expect(drawing.poche.length).toBe(cut(concrete).length + plan.ground.columns.length + 1);
    expect(drawing.hatch).toEqual(cut(partitions));
  });

  it('draws one swing arc per door', () => {
    const doors = plan.ground.walls.flatMap((wall) => (wall.openings ?? []).filter((opening) => opening.type === 'door'));
    expect(drawing.arcs.filter((arc) => arc.ink === 'line' && arc.weight === 'hair').length).toBe(doors.length);
  });

  it('names every room with its area and level, marks the stair and titles the sheet', () => {
    const texts = drawing.labels.map((label) => label.text);
    for (const room of plan.ground.rooms) {
      expect([room.name, room.abbr].map((name) => name?.toUpperCase()).some((name) => name && texts.includes(name)), room.name).toBe(true);
    }
    expect(texts).toContain('NPT ±0,00');
    expect(texts).toContain('SUBE');
    expect(texts).toContain('PLANTA BAJA');
    expect(texts).toContain('N');
    expect(texts.some((text) => text.endsWith('m²'))).toBe(true);
  });

  it('dimensions the axes, the bar and its cantilever, and the whole house, with a decimal comma', () => {
    const texts = drawing.labels.map((label) => label.text);
    for (const span of ['4,50', '5,10', '6,75', '15,00', '6,60', '21,60', '8,10', '10,20']) expect(texts).toContain(span);
    expect(texts.filter((text) => /\d\.\d/.test(text))).toEqual([]);
  });

  it('turns the text of the north-south dimensions to read upwards', () => {
    const turned = drawing.labels.filter((label) => label.quarter);
    expect(turned.map((label) => label.text)).toContain('8,10');
    expect(drawing.labels.filter((label) => !label.quarter).map((label) => label.text)).not.toContain('8,10');
  });

  it('marks the level once per floor and where the floor changes level', () => {
    const levels = drawing.labels.filter((label) => label.text.startsWith('NPT')).map((label) => label.text);
    expect(levels).toEqual(['NPT ±0,00', 'NPT −0,05']);
  });

  it('dimensions the blade past both ends of the house on the west, and notes what it is', () => {
    const west = drawing.labels.filter((label) => label.quarter && label.at[0] < plan.blade.x[0]).map((label) => label.text);
    expect(west).toEqual(['1,50', '10,20', '1,50']);
    expect(drawing.labels.map((label) => label.text)).toContain('MURO H° VISTO e 0,30 · h +7,15');
  });

  it('notes the upper slab in projection with the depth of its post-tensioned concrete', () => {
    expect(drawing.labels.map((label) => label.text)).toContain('PROYECCIÓN LOSA P. ALTA · POSTESADA e=0,28');
  });

  it('draws the canopy over the front door dashed, above the cut', () => {
    const { x, z } = plan.canopy;
    const corners = [[x[0], z[0]], [x[1], z[0]], [x[1], z[1]], [x[0], z[1]]];
    expect(drawing.strokes).toContainEqual(expect.objectContaining({ dash: 'dashed', points: corners }));
  });

  it("still draws the main house's two sheets as they were before a plan could leave parts out", () => {
    // Counted and lettered on the sheets as drawn before T18.
    const before: Record<LevelId, { counts: Record<string, number>; first: string[]; last: string[] }> = {
      ground: {
        counts: { poche: 9, hatch: 6, strokes: 153, arcs: 6, solids: 2, circles: 15, labels: 49 },
        first: ['SUBE', '1', '19', '19 alz. 17,6 / 18 pis. 28', 'PROYECCIÓN LOSA P. ALTA · POSTESADA e=0,28', 'MURO H° VISTO e 0,30 · h +7,15'],
        last: ['GALERÍA', '55,44 m²', 'NPT −0,05', 'PLANTA BAJA', '0', '1', '2', '5', 'm', 'N'],
      },
      upper: {
        counts: { poche: 9, hatch: 17, strokes: 142, arcs: 13, solids: 1, circles: 8, labels: 47 },
        first: ['MURO H° VISTO e 0,30 · h +7,15', '1', '2', '3', '4', 'A', 'B'],
        last: ['VEST.', '4,72 m²', 'PLANTA ALTA', '0', '1', '2', '5', 'm', 'N'],
      },
    };
    const strings = ['4,50', '5,10', '5,10', '6,75', '15,00', '6,60', '21,60', '8,10', '8,40', '1,80', '10,20', '1,50', '10,20', '1,50'];
    for (const id of LEVELS) {
      const sheet = planDrawing(plan, frame, id);
      const counts = Object.fromEntries(Object.entries(sheet).map(([key, items]) => [key, items.length]));
      expect(counts, id).toEqual(before[id].counts);
      const texts = sheet.labels.map((label) => label.text);
      expect(texts.slice(0, before[id].first.length), id).toEqual(before[id].first);
      expect(texts.slice(-before[id].last.length), id).toEqual(before[id].last);
      // Every dimension string, in the order they are drawn: axes, the bar and its cantilever, overall, the blade.
      expect(texts.filter((text) => /^\d+,\d\d$/.test(text)), id).toEqual(strings);
    }
  });
});

describe('the sheet of a house without the main house’s extras', () => {
  const texts = () => planDrawing(cottage, cottageFrame).labels.map((label) => label.text);

  it('draws a one-storey house with no blade, canopy, galería or terrace', () => {
    expect(() => planDrawing(cottage, cottageFrame)).not.toThrow();
    expect(texts()).toEqual(expect.arrayContaining(['ESTAR COMEDOR', 'COCINA', 'BAÑO', 'DORMITORIO', 'NPT ±0,00', 'PLANTA']));
  });

  it('cuts only its own walls: no blade in the poché', () => {
    const drawing = planDrawing(cottage, cottageFrame);
    const { floor, ceiling } = levelHeights(cottage, 'ground');
    const cut = (kind: Wall['kind']) => cottage.ground.walls.filter((wall) => wall.kind === kind).flatMap((wall) => cutPieces(wall, cottage, ceiling - floor));
    expect(drawing.poche).toEqual(cut('concrete'));
    expect(drawing.hatch).toEqual(cut('partition'));
  });

  it('draws nothing of the parts it does not have', () => {
    const drawing = planDrawing(cottage, cottageFrame);
    // No upper slab or canopy in projection: nothing in this plan is dashed.
    expect(drawing.strokes.filter((stroke) => stroke.dash === 'dashed')).toEqual([]);
    // No galería paving: the only outline seen below the cut is the slab's edge.
    const outlines = drawing.strokes.filter((stroke) => stroke.ink === 'line' && stroke.weight === 'beyond' && stroke.closed);
    expect(outlines.map((stroke) => stroke.points)).toEqual([[[0, 0], [12, 0], [12, 8], [0, 8]]]);
    // No notes for the slab above or the blade, and no blade string west of the house.
    expect(texts().filter((text) => /PROYECCIÓN|MURO/.test(text))).toEqual([]);
    expect(drawing.labels.filter((label) => label.quarter && label.at[0] < cottage.ground.slab.x[0])).toEqual([]);
  });

  it('dimensions the axes and the whole house, without a face-to-face string that would only repeat the overall', () => {
    const all = texts();
    expect(all.filter((text) => text === '12,00')).toHaveLength(1);
    expect(all.filter((text) => text === '8,00')).toHaveLength(1);
    expect(all).toEqual(expect.arrayContaining(['11,70', '7,70']));
  });

  it('refuses to draw an upper floor the house does not have', () => {
    expect(() => planDrawing(cottage, cottageFrame, 'upper')).toThrow(/no upper floor/);
  });
});

describe('the frame of a sheet', () => {
  it("bounds the main house as before: the blade's west face to the cantilever, the ground floor north to south", () => {
    expect(sheetBounds(plan)).toEqual({ x: [0, 21.6], z: [0, 10.2] });
  });

  it('bounds a house by the parts it has', () => {
    expect(sheetBounds(cottage)).toEqual(cottage.ground.slab);
    const porch: Rect = { x: [12, 15], z: [2, 6] };
    expect(sheetBounds({ ...cottage, galeria: porch })).toEqual({ x: [0, 15], z: [0, 8] });
  });

  it("centres the main house's sheet on its plot where the site does", () => {
    expect(sheetOffset(plan)).toEqual(planOffset(plan));
    expect(sheetOffset(cottage)).toEqual({ x: -6, z: -4 });
  });
});

describe('the lettering of each plan', () => {
  const frame = {
    bounds: { x: [plan.blade.x[0], plan.upper.slab.x[1]], z: [plan.ground.slab.z[0], plan.ground.slab.z[1]] },
    sheet: { x: [-2.2, 23.8], z: [-3.9, 14.1] },
  } satisfies { bounds: Rect; sheet: Rect };

  /** The square a door leaf sweeps, and whether a rect reaches into its quarter circle. */
  const intoSwing = (rect: Rect, wall: Wall, opening: Extract<Opening, { type: 'door' }>) => {
    const { hinge, tip, jamb, radius } = doorSwing(wall, opening);
    const corner: Point = [tip[0] + jamb[0] - hinge[0], tip[1] + jamb[1] - hinge[1]];
    const xs = [hinge[0], tip[0], jamb[0], corner[0]];
    const zs = [hinge[1], tip[1], jamb[1], corner[1]];
    const square: Rect = { x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)] };
    const nearest = [0, 1].map((axis) => {
      const range = axis === 0 ? rect.x : rect.z;
      return Math.min(Math.max(hinge[axis], range[0]), range[1]) - hinge[axis];
    });
    return overlaps(rect, square) && Math.hypot(nearest[0], nearest[1]) < radius;
  };

  // The main house's two floors, and a one-storey house drawn on its own plot. Each sheet is drawn
  // inside its tests, so a plan that cannot be drawn fails them instead of the whole file.
  const sheets: { name: string; level: Level; draw: () => PlanDrawing }[] = [
    ...LEVELS.map((id) => ({ name: id, level: plan[id], draw: () => planDrawing(plan, frame, id) })),
    { name: 'one-storey', level: cottage.ground, draw: () => planDrawing(cottage, cottageFrame) },
  ];

  for (const { name: id, level, draw } of sheets) {
    const roomTexts = (drawing: PlanDrawing, room: Room) => {
      const [x, z] = room.label ?? [(room.rect.x[0] + room.rect.x[1]) / 2, (room.rect.z[0] + room.rect.z[1]) / 2];
      return drawing.labels.filter((label) => label.at[0] === x && label.at[1] > z - 0.2 && label.at[1] < z + 0.6);
    };

    it(`letters every room of the ${id} plan inside its walls, clear of its fittings and door swings`, () => {
      const drawing = draw();
      for (const room of level.rooms) {
        const texts = roomTexts(drawing, room);
        expect(texts.length, room.name).toBeGreaterThanOrEqual(1);
        for (const label of texts) {
          const box = labelBox(label);
          expect(contains(room.rect, box), `${room.name}: ${label.text}`).toBe(true);
          for (const fixture of level.fixtures) expect(overlaps(box, fixture.rect), `${room.name}: ${label.text} on a ${fixture.kind}`).toBe(false);
          for (const wall of level.walls) {
            for (const opening of wall.openings ?? []) {
              if (opening.type === 'door') expect(intoSwing(box, wall, opening), `${room.name}: ${label.text} in a door swing`).toBe(false);
            }
          }
        }
      }
    });

    it(`never letters one note over another on the ${id} plan`, () => {
      const boxes = draw().labels.map((label) => ({ label, box: labelBox(label) }));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(overlaps(boxes[i].box, boxes[j].box), `${boxes[i].label.text} / ${boxes[j].label.text}`).toBe(false);
        }
      }
    });
  }
});
