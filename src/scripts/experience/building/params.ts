import {
  levelHeights,
  openingHeights,
  openingSpan,
  runsAlongX,
  wallBlocks,
  doorSwing,
  overlaps,
  type Level,
  type LevelId,
  type Opening,
  type Plan,
  type Rect,
  type SheetPlan,
  type Wall,
} from './plan';

/*
 * The procedural building as plain numbers: boxes tagged with their exploded
 * layer and their material, the three volumes it is composed of, and the
 * edges the sketch draws. No three.js here, so the composition can be tested
 * and re-proportioned per architect from the config alone.
 *
 * Every wall, opening, column and slab is raised from the floor plan
 * (src/config/plan.ts), so the extrusion builds exactly what the plan draws.
 * The studio's other houses (src/config/projects/) are raised from theirs the
 * same way, by `deriveModel`, for the models on their sheets.
 *
 * Axes: x along the site's width, y up, z towards the viewer (the front,
 * which is north: the garden). The composition: a glazed ground floor (base),
 * an upper bar that cantilevers past it over the galería, and a concrete
 * blade wall that closes the west side and runs past both ends of the house.
 */

export const LAYERS = ['estructura', 'envolvente', 'luz', 'habitar'] as const;
export type LayerId = (typeof LAYERS)[number];
export type MaterialKind = 'concrete' | 'wood' | 'glass';
export type Vec3 = [number, number, number];

export interface Box {
  min: Vec3;
  max: Vec3;
}

export interface Part {
  layer: LayerId;
  kind: MaterialKind;
  box: Box;
}

export interface SketchLine {
  from: Vec3;
  to: Vec3;
  direction: 'vertical' | 'horizontal';
}

export interface BuildingConfig {
  site: { width: number; depth: number };
  plan: Plan;
}

/** A house raised from its plans. */
export interface Model {
  parts: Part[];
  height: number;
  /** Level of the upper floor, where the interior light starts its second storey; the roof's, on one storey. */
  storey: number;
}

export interface Building extends Model {
  /** Base, upper bar and blade, in that order. */
  volumes: [Box, Box, Box];
  layerBounds: Record<LayerId, Box>;
  sketch: SketchLine[];
}

export type Detail = 'full' | 'low';

const GLASS = 0.06;
const FRAME = 0.08;
const FRAME_DEPTH = 0.14;
const LEAF = 0.045;
const RAIL = 1.0;
/** The terrace's deck and gravel bed. */
const DECK = 0.06;
/** The main house's roof slab overhangs the upper bar by this much; the other houses draw their eaves in their footprints. */
const EAVE = 0.15;

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({
  min: [x0, y0, z0],
  max: [x1, y1, z1],
});

/** Plan coordinates, moved by `offset`, to the box between two heights. */
const placer =
  (offset: { x: number; z: number }) =>
  (rect: Rect, y0: number, y1: number): Box =>
    box(rect.x[0] + offset.x, rect.x[1] + offset.x, y0, y1, rect.z[0] + offset.z, rect.z[1] + offset.z);

const grow = (rect: Rect, by: number): Rect => ({ x: [rect.x[0] - by, rect.x[1] + by], z: [rect.z[0] - by, rect.z[1] + by] });

/** Plan coordinates to the scene's: the house centred on the site along x, the ground floor centred along z. */
export function planOffset(plan: Plan): { x: number; z: number } {
  const { ground, upper } = plan;
  const west = Math.min(ground.slab.x[0], upper.slab.x[0]);
  const east = Math.max(ground.slab.x[1], upper.slab.x[1]);
  return { x: -(west + east) / 2, z: -(ground.slab.z[0] + ground.slab.z[1]) / 2 };
}

/** Positions from `from` to `to` (exclusive of both ends), about `step` apart. */
function divisions(from: number, to: number, step: number): number[] {
  const count = Math.max(1, Math.round((to - from) / step));
  return Array.from({ length: count - 1 }, (_, i) => from + ((to - from) * (i + 1)) / count);
}

function union(boxes: Box[]): Box {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], b.min[axis]);
      max[axis] = Math.max(max[axis], b.max[axis]);
    }
  }
  return { min, max };
}

/** The rect minus a hole, as up to four strips around it. */
function subtract(rect: Rect, hole: Rect): Rect[] {
  const x0 = Math.max(rect.x[0], hole.x[0]);
  const x1 = Math.min(rect.x[1], hole.x[1]);
  const z0 = Math.max(rect.z[0], hole.z[0]);
  const z1 = Math.min(rect.z[1], hole.z[1]);
  if (x0 >= x1 || z0 >= z1) return [rect];
  const strips: Rect[] = [
    { x: rect.x, z: [rect.z[0], z0] },
    { x: rect.x, z: [z1, rect.z[1]] },
    { x: [rect.x[0], x0], z: [z0, z1] },
    { x: [x1, rect.x[1]], z: [z0, z1] },
  ];
  return strips.filter((strip) => strip.x[1] - strip.x[0] > 1e-6 && strip.z[1] - strip.z[0] > 1e-6);
}

const subtractAll = (rects: Rect[], holes: readonly Rect[]) => holes.reduce((pieces, hole) => pieces.flatMap((piece) => subtract(piece, hole)), rects);

/** The same ground as `rects`, cut so no two pieces overlap: two slabs never share a face. */
const disjoint = (rects: readonly Rect[]) => rects.reduce<Rect[]>((pieces, rect) => [...pieces, ...subtractAll([rect], pieces)], []);

/** A level's floor: its footprint where it has one (an L, a ring around a patio), else its slab. */
const floorOf = (level: Level) => disjoint(level.footprint ?? [level.slab]);

/** Where two rects overlap; none when they only touch. */
function intersect(a: Rect, b: Rect): Rect[] {
  const x: [number, number] = [Math.max(a.x[0], b.x[0]), Math.min(a.x[1], b.x[1])];
  const z: [number, number] = [Math.max(a.z[0], b.z[0]), Math.min(a.z[1], b.z[1])];
  return x[1] - x[0] > 1e-6 && z[1] - z[0] > 1e-6 ? [{ x, z }] : [];
}

function boxEdges(b: Box): SketchLine[] {
  const [x0, y0, z0] = b.min;
  const [x1, y1, z1] = b.max;
  const corners: [number, number][] = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  const lines: SketchLine[] = corners.map(([x, z]) => ({ from: [x, y0, z], to: [x, y1, z], direction: 'vertical' }));
  for (const y of [y0, y1]) {
    corners.forEach(([x, z], i) => {
      const [nx, nz] = corners[(i + 1) % 4];
      lines.push({ from: [x, y, z], to: [nx, y, nz], direction: 'horizontal' });
    });
  }
  return lines;
}

/**
 * Any house raised from its plans, in plan coordinates moved by `offset`: the main house, or another
 * one with one storey and no blade, canopy, galería or terrace, whose floor may follow a footprint.
 * What a house does not have is not built. A patio open to the sky (a void in the ground floor) stays
 * open through every slab and the roof; a stair well is roofed. `eave`: how far the roof overhangs
 * the top floor.
 */
export function deriveModel(plan: SheetPlan, detail: Detail, offset: { x: number; z: number }, eave = 0): Model {
  const { upper, blade, terrace } = plan;
  const { slab, ground: groundHeight } = plan.heights;
  const upperHeight = upper ? plan.heights.upper : 0;
  if (upperHeight === undefined) throw new Error('This plan gives no height for an upper floor (heights.upper).');
  const top = groundHeight + upperHeight;
  const at = placer(offset);
  const levels: LevelId[] = upper ? ['ground', 'upper'] : ['ground'];
  const groundVoids = plan.ground.voids ?? [];
  const besideBlade = blade ? [blade] : [];

  const parts: Part[] = [];
  const add = (layer: LayerId, kind: MaterialKind, b: Box) => parts.push({ layer, kind, box: b });

  // Estructura: the slabs (the upper one open over the stair, both open over a patio), the galería's paving,
  // the columns. The slabs stop at the blade, which runs from the ground to the roof.
  for (const piece of subtractAll(floorOf(plan.ground), [...besideBlade, ...groundVoids])) add('estructura', 'concrete', at(piece, 0, slab));
  if (plan.galeria) add('estructura', 'concrete', at(plan.galeria, 0, slab - 0.05));
  if (upper) {
    const upperFloor = floorOf(upper).flatMap((piece) => [...subtract(piece, plan.ground.slab), ...intersect(piece, plan.ground.slab)]);
    for (const piece of subtractAll(upperFloor, upper.voids ?? [])) add('estructura', 'concrete', at(piece, groundHeight - slab, groundHeight));
  }
  // Under the terrace the same slab, its top a step lower, under the deck; the canopy at its level.
  // With no terrace, the roof the upper floor leaves to the ground floor lies level with the upper floor.
  const terraceFloor = groundHeight - (terrace?.drop ?? 0);
  if (upper) {
    for (const piece of subtractAll(floorOf(plan.ground), [...floorOf(upper), ...besideBlade, ...groundVoids])) {
      add('estructura', 'concrete', at(piece, groundHeight - slab, terrace ? terraceFloor - DECK : groundHeight));
    }
  }
  if (plan.canopy) add('estructura', 'concrete', at(plan.canopy, groundHeight - slab, terraceFloor));
  const half = plan.column / 2;
  for (const id of levels) {
    const { floor, ceiling } = levelHeights(plan, id);
    for (const [x, z] of plan[id]!.columns) add('estructura', 'concrete', at({ x: [x - half, x + half], z: [z - half, z + half] }, floor, ceiling));
  }

  // Envolvente: every wall of every floor, with the sills and lintels around its openings; the blade.
  // Luz: the glass and the wooden frames and door leaves in those openings, and the glass rails.
  for (const id of levels) {
    const { floor, ceiling } = levelHeights(plan, id);
    const clear = ceiling - floor;
    for (const wall of plan[id]!.walls) {
      for (const block of wallBlocks(wall, plan, clear)) add('envolvente', 'concrete', at(block.rect, floor + block.y[0], floor + block.y[1]));
      for (const opening of wall.openings ?? []) carpentry(wall, opening, floor, clear);
    }
    for (const rail of plan[id]!.rails ?? []) add('luz', 'glass', at(rail, floor, floor + RAIL));
  }
  if (blade) add('envolvente', 'concrete', at(blade, 0, blade.height));

  /** Glass, frames and leaves for one opening. */
  function carpentry(wall: Wall, opening: Opening, floor: number, clear: number) {
    const alongX = runsAlongX(wall);
    const [a, b] = openingSpan(wall, opening);
    const across = alongX ? wall.z : wall.x;
    const mid = (across[0] + across[1]) / 2;
    const [bottom, top] = openingHeights(opening, plan, clear);
    const y0 = floor + bottom;
    const y1 = floor + top;
    /** A box spanning `from`..`to` along the wall and `half` either side of its middle. */
    const run = (from: number, to: number, halfDepth: number, yb: number, yt: number) =>
      alongX
        ? at({ x: [from, to], z: [mid - halfDepth, mid + halfDepth] }, yb, yt)
        : at({ x: [mid - halfDepth, mid + halfDepth], z: [from, to] }, yb, yt);

    if (opening.type === 'passage') return;
    if (opening.type === 'door') {
      const swing = doorSwing(wall, opening);
      const [hx, hz] = swing.hinge;
      const [tx, tz] = swing.tip;
      const inward = opening.hinge === 'min' ? 1 : -1;
      const leaf: Rect = alongX
        ? { x: inward > 0 ? [hx, hx + LEAF] : [hx - LEAF, hx], z: [Math.min(hz, tz), Math.max(hz, tz)] }
        : { x: [Math.min(hx, tx), Math.max(hx, tx)], z: inward > 0 ? [hz, hz + LEAF] : [hz - LEAF, hz] };
      add('luz', 'wood', at(leaf, y0, y1 - 0.01));
      return;
    }

    add('luz', 'glass', run(a, b, GLASS / 2, y0, y1));
    let inner: number[];
    if (opening.type === 'slider') {
      // A post where each leaf meets the next; the low tier keeps every other one.
      inner = divisions(a, b, (b - a) / opening.leaves).filter((_, i) => detail === 'full' || i % 2 === 1);
    } else {
      // Fixed mullions where partitions meet the glass, and lighter ones between them.
      const fixed = opening.type === 'window' ? (opening.mullions ?? []).map((m) => a + m) : [];
      const stops = [a, ...fixed, b];
      const step = detail === 'full' ? 2 : 4;
      inner = [...fixed, ...stops.slice(1).flatMap((stop, i) => divisions(stops[i], stop, step))];
    }
    const posts = [a + FRAME / 2, ...inner, b - FRAME / 2];
    for (const s of posts) add('luz', 'wood', run(s - FRAME / 2, s + FRAME / 2, FRAME_DEPTH / 2, y0, y1));
    add('luz', 'wood', run(a, b, FRAME_DEPTH / 2, y1 - 0.1, y1));
    add('luz', 'wood', run(a, b, FRAME_DEPTH / 2, y0, y0 + 0.08));
  }

  // Habitar: the roof over the top floor, open over a patio, and the terrace on the base with its deck and parapets.
  const roofed = upper ?? plan.ground;
  const sky = (roofed.voids ?? []).filter((hole) => groundVoids.some((open) => overlaps(open, hole)));
  const roof = disjoint((roofed.footprint ?? [roofed.slab]).map((rect) => grow(rect, eave)));
  for (const piece of subtractAll(roof, sky)) add('habitar', 'concrete', at(piece, top - slab, top));
  if (terrace) {
    const { parapet } = plan.heights;
    if (parapet === undefined) throw new Error('This plan has a terrace but no height for its parapet (heights.parapet).');
    for (const deck of terrace.decks) add('habitar', 'wood', at(deck, terraceFloor - DECK, terraceFloor));
    for (const bed of terrace.gravel) add('habitar', 'concrete', at(bed, terraceFloor - DECK, terraceFloor));
    for (const wall of terrace.parapets) add('habitar', 'concrete', at(wall, terraceFloor - DECK, terraceFloor + parapet));
    for (const rail of terrace.rails) add('luz', 'glass', at(rail, terraceFloor, terraceFloor + RAIL));
  }

  return { parts, height: Math.max(top, blade?.height ?? 0), storey: upper ? groundHeight : top };
}

/** The main house: its model, plus the volumes, the layers' bounds and the sketch the scenes before the table read. */
export function deriveBuilding(config: BuildingConfig, detail: Detail): Building {
  const { plan } = config;
  const offset = planOffset(plan);
  const model = deriveModel(plan, detail, offset, EAVE);
  const { ground: groundHeight, upper: upperHeight } = plan.heights;
  const top = groundHeight + upperHeight;
  const at = placer(offset);
  const baseBox = at(plan.ground.slab, 0, groundHeight);
  const upperBox = at(plan.upper.slab, groundHeight, top);
  const bladeBox = at(plan.blade, 0, plan.blade.height);

  const layerBounds = Object.fromEntries(
    LAYERS.map((layer) => [layer, union(model.parts.filter((part) => part.layer === layer).map((part) => part.box))]),
  ) as Record<LayerId, Box>;
  // The sketch: every volume's edges, the ribbon window, and two datum lines on the ground.
  const edges = [baseBox, upperBox, bladeBox].flatMap(boxEdges);
  const ribbonWall = plan.upper.walls.find((wall) => wall.z[1] === plan.upper.slab.z[1] && runsAlongX(wall));
  const ribbon = ribbonWall?.openings?.find((opening) => opening.type === 'window');
  const [bx0, by0] = upperBox.min;
  const [bx1, , bz1] = upperBox.max;
  if (ribbon && ribbon.type === 'window') {
    for (const y of [by0 + ribbon.sill, by0 + ribbon.head]) {
      edges.push({ from: [bx0, y, bz1], to: [bx1, y, bz1], direction: 'horizontal' });
    }
  }
  const [, , az1] = baseBox.max;
  const [ax1] = baseBox.max;
  edges.push(
    { from: [-config.site.width / 2 - 1, 0, az1 + 1.2], to: [config.site.width / 2 + 1, 0, az1 + 1.2], direction: 'horizontal' },
    { from: [ax1, 0, -config.site.depth / 2 - 1], to: [ax1, 0, config.site.depth / 2 + 1], direction: 'horizontal' },
  );
  const sketch = [
    ...edges.filter((line) => line.direction === 'vertical'),
    ...edges.filter((line) => line.direction === 'horizontal'),
  ];

  return { ...model, volumes: [baseBox, upperBox, bladeBox], layerBounds, sketch };
}
