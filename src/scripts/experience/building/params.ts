import {
  levelHeights,
  openingHeights,
  openingSpan,
  runsAlongX,
  wallBlocks,
  doorSwing,
  type LevelId,
  type Opening,
  type Plan,
  type Rect,
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
 *
 * Axes: x along the site's width, y up, z towards the viewer (the front,
 * which is north: the garden). The composition: a glazed ground floor (base),
 * an upper bar that cantilevers past it over the galería, and a
 * free-standing concrete blade wall on the west that rises above both.
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

export interface Building {
  parts: Part[];
  /** Base, upper bar and blade, in that order. */
  volumes: [Box, Box, Box];
  height: number;
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
/** The roof slab overhangs the upper bar by this much. */
const EAVE = 0.15;

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({
  min: [x0, y0, z0],
  max: [x1, y1, z1],
});

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

export function deriveBuilding(config: BuildingConfig, detail: Detail): Building {
  const { plan } = config;
  const { slab, ground: groundHeight, upper: upperHeight, parapet } = plan.heights;
  const offset = planOffset(plan);
  const top = groundHeight + upperHeight;
  const at = (rect: Rect, y0: number, y1: number): Box =>
    box(rect.x[0] + offset.x, rect.x[1] + offset.x, y0, y1, rect.z[0] + offset.z, rect.z[1] + offset.z);

  const parts: Part[] = [];
  const add = (layer: LayerId, kind: MaterialKind, b: Box) => parts.push({ layer, kind, box: b });

  const baseBox = at(plan.ground.slab, 0, groundHeight);
  const upperBox = at(plan.upper.slab, groundHeight, top);
  const bladeBox = at(plan.blade, 0, plan.blade.height);

  // Estructura: the slabs (the upper one open over the stair), the galería's paving, the columns.
  add('estructura', 'concrete', at(plan.ground.slab, 0, slab));
  add('estructura', 'concrete', at(plan.galeria, 0, slab - 0.05));
  const upperFloor = [...subtract(plan.upper.slab, plan.ground.slab), ...intersect(plan.upper.slab, plan.ground.slab)];
  for (const piece of subtractAll(upperFloor, plan.upper.voids ?? [])) add('estructura', 'concrete', at(piece, groundHeight - slab, groundHeight));
  // Under the terrace the same slab, its top a step lower, under the deck.
  const terraceFloor = groundHeight - plan.terrace.drop;
  for (const piece of subtract(plan.ground.slab, plan.upper.slab)) add('estructura', 'concrete', at(piece, groundHeight - slab, terraceFloor - DECK));
  const half = plan.column / 2;
  const groundLevel = levelHeights(plan, 'ground');
  for (const [x, z] of plan.ground.columns) {
    add('estructura', 'concrete', at({ x: [x - half, x + half], z: [z - half, z + half] }, groundLevel.floor, groundLevel.ceiling));
  }

  // Envolvente: every wall of both plans, with the sills and lintels around its openings; the blade.
  // Luz: the glass and the wooden frames and door leaves in those openings, and the stair's glass rail.
  for (const id of ['ground', 'upper'] as const satisfies readonly LevelId[]) {
    const { floor, ceiling } = levelHeights(plan, id);
    const clear = ceiling - floor;
    for (const wall of plan[id].walls) {
      for (const block of wallBlocks(wall, plan, clear)) add('envolvente', 'concrete', at(block.rect, floor + block.y[0], floor + block.y[1]));
      for (const opening of wall.openings ?? []) carpentry(wall, opening, floor, clear);
    }
    for (const rail of plan[id].rails ?? []) add('luz', 'glass', at(rail, floor, floor + RAIL));
  }
  add('envolvente', 'concrete', bladeBox);

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

  // Habitar: the roof, and the terrace on the base with its deck and parapets.
  const roof: Rect = {
    x: [plan.upper.slab.x[0] - EAVE, plan.upper.slab.x[1] + EAVE],
    z: [plan.upper.slab.z[0] - EAVE, plan.upper.slab.z[1] + EAVE],
  };
  add('habitar', 'concrete', at(roof, top - slab, top));
  for (const deck of plan.terrace.decks) add('habitar', 'wood', at(deck, terraceFloor - DECK, terraceFloor));
  for (const bed of plan.terrace.gravel) add('habitar', 'concrete', at(bed, terraceFloor - DECK, terraceFloor));
  for (const wall of plan.terrace.parapets) add('habitar', 'concrete', at(wall, terraceFloor - DECK, terraceFloor + parapet));
  for (const rail of plan.terrace.rails) add('luz', 'glass', at(rail, terraceFloor, terraceFloor + RAIL));

  const layerBounds = Object.fromEntries(
    LAYERS.map((layer) => [layer, union(parts.filter((part) => part.layer === layer).map((part) => part.box))]),
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

  return {
    parts,
    volumes: [baseBox, upperBox, bladeBox],
    height: Math.max(top, plan.blade.height),
    layerBounds,
    sketch,
  };
}
