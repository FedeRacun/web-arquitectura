/*
 * The floor plan the house is built from. The data lives in
 * src/config/plan.ts; this module holds its types, the wall pieces that both
 * the drawing and the extrusion are cut from, and the drawing itself as
 * plain primitives. No canvas and no three.js here, so the plan can be
 * tested and the drawing and the walls can never disagree.
 *
 * Plan coordinates are metres: x runs east along the house, z runs north,
 * towards the garden and the viewer. A plan is cut at 1.20 m above its
 * floor, as architects cut it: whatever is solid at that height is poché.
 */

export type Range = readonly [number, number];
export type Point = readonly [number, number];

export interface Rect {
  readonly x: Range;
  readonly z: Range;
}

/** `at` is measured along the wall from its west or south end; heights from the level's floor. */
export type Opening =
  | {
      readonly type: 'door';
      readonly at: number;
      readonly width: number;
      /** Which end of the opening the leaf hangs from: the west/south one (min) or the east/north one (max). */
      readonly hinge: 'min' | 'max';
      /** The side of the wall the leaf swings to: +1 east/north, -1 west/south. */
      readonly side: 1 | -1;
      readonly head?: number;
    }
  | {
      readonly type: 'window';
      readonly at: number;
      readonly width: number;
      readonly sill: number;
      readonly head: number;
      /** Fixed mullions, metres from the window's start: where a partition meets the glass. */
      readonly mullions?: readonly number[];
    }
  /** A sliding glass door, floor to ceiling. */
  | { readonly type: 'slider'; readonly at: number; readonly width: number; readonly leaves: number }
  /** Fixed glass, floor to ceiling. */
  | { readonly type: 'glass'; readonly at: number; readonly width: number }
  /** A doorless opening up to the door head. */
  | { readonly type: 'passage'; readonly at: number; readonly width: number };

/** Concrete: exposed load-bearing walls. Partition: plastered brick. Glazing: a wall made only of its openings. */
export type WallKind = 'concrete' | 'partition' | 'glazing';

export interface Wall extends Rect {
  readonly kind: WallKind;
  readonly openings?: readonly Opening[];
}

export interface Room {
  readonly name: string;
  /** Lettered instead of the name where the name is wider than the room, as a drafter abbreviates. */
  readonly abbr?: string;
  /** The floor the area is measured on. */
  readonly rect: Rect;
  /** Where the label sits, if not at the centre. */
  readonly label?: Point;
  /** Carries the level mark: one room per level, and wherever the floor changes level. */
  readonly npt?: boolean;
  /** Covered on top but open on the sides: counted apart. */
  readonly semicovered?: boolean;
}

export type FixtureKind =
  | 'counter'
  | 'island'
  | 'sink'
  | 'cooktop'
  | 'tall'
  | 'wc'
  | 'basin'
  | 'shower'
  | 'bath'
  | 'washer'
  | 'tub'
  | 'table'
  | 'sofa'
  | 'armchair'
  | 'bed'
  | 'wardrobe'
  | 'desk';

/** Furniture and fittings: drawn in the plan only, as an architect draws them. */
export interface Fixture {
  readonly kind: FixtureKind;
  readonly rect: Rect;
  /** The direction a user of the fixture faces: the wc bowl, the sofa seat, the bed's foot. */
  readonly facing: 'n' | 's' | 'e' | 'w';
  /** Chairs per long side, for tables. */
  readonly seats?: number;
}

export interface Stair extends Rect {
  readonly risers: number;
  /** The direction the stair rises. */
  readonly up: 'e' | 'w' | 'n' | 's';
}

export interface Level {
  readonly name: string;
  /** The floor slab under this level. */
  readonly slab: Rect;
  readonly walls: readonly Wall[];
  /** Column centres. */
  readonly columns: readonly Point[];
  readonly rooms: readonly Room[];
  readonly fixtures: readonly Fixture[];
  /** Openings in this level's floor slab (the stair well). */
  readonly voids?: readonly Rect[];
  /** Glass balustrades along the voids. */
  readonly rails?: readonly Rect[];
  /** The stair that leaves this level. */
  readonly stair?: Stair;
}

export interface GridAxis {
  readonly id: string;
  readonly at: number;
}

export interface Plan {
  readonly heights: {
    /** Slab thickness, with the floor's build-up. */
    readonly slab: number;
    /** Of that, the structural concrete. */
    readonly structure: number;
    /** Ground to the upper floor (the top of its slab). */
    readonly ground: number;
    /** Upper floor to the top of the roof. */
    readonly upper: number;
    /** Door head above its floor. */
    readonly door: number;
    /** Terrace parapet above the terrace floor. */
    readonly parapet: number;
  };
  /** Square column side. */
  readonly column: number;
  /** Structural axes: x lines are numbered, z lines lettered. */
  readonly grid: { readonly x: readonly GridAxis[]; readonly z: readonly GridAxis[] };
  readonly ground: Level;
  readonly upper: Level;
  /** The concrete wall that closes the west side, past both ends of the house. */
  readonly blade: Rect & { readonly height: number };
  /** The slab over the front door, carried by the blade at the terrace's level. */
  readonly canopy: Rect;
  /** Paving under the cantilever. */
  readonly galeria: Rect;
  /** The base's roof that the upper floor does not cover: a terrace with a parapet. */
  readonly terrace: {
    /** How far the terrace floor sits below the upper floor, so the threshold can be sealed. */
    readonly drop: number;
    readonly decks: readonly Rect[];
    /** Roof that is not walked on, finished in gravel. */
    readonly gravel: readonly Rect[];
    readonly parapets: readonly Rect[];
    /** Glass balustrades between the deck and the gravel. */
    readonly rails: readonly Rect[];
  };
}

export type LevelId = 'ground' | 'upper';

/** Height of the horizontal cut a plan is drawn at, above its floor. */
export const CUT_HEIGHT = 1.2;

const EPS = 1e-6;

export const length = (range: Range) => range[1] - range[0];
export const area = (rect: Rect) => length(rect.x) * length(rect.z);
export const centre = (rect: Rect): Point => [(rect.x[0] + rect.x[1]) / 2, (rect.z[0] + rect.z[1]) / 2];

/** A wall runs along its longer side. */
export const runsAlongX = (rect: Rect) => length(rect.x) >= length(rect.z);

/** Whether two rects share more than an edge. */
export function overlaps(a: Rect, b: Rect) {
  return a.x[0] < b.x[1] - EPS && b.x[0] < a.x[1] - EPS && a.z[0] < b.z[1] - EPS && b.z[0] < a.z[1] - EPS;
}

export function contains(outer: Rect, inner: Rect) {
  return (
    inner.x[0] >= outer.x[0] - EPS &&
    inner.x[1] <= outer.x[1] + EPS &&
    inner.z[0] >= outer.z[0] - EPS &&
    inner.z[1] <= outer.z[1] + EPS
  );
}

/** Floor and ceiling of a level, as heights above the ground the house stands on. */
export function levelHeights(plan: Plan, level: LevelId) {
  const { slab, ground, upper } = plan.heights;
  return level === 'ground'
    ? { floor: slab, ceiling: ground - slab, nivel: 0 }
    : { floor: ground, ceiling: ground + upper - slab, nivel: ground - slab };
}

/** The opening's vertical extent above its floor, given the room's height. */
export function openingHeights(opening: Opening, plan: Plan, clear: number): Range {
  switch (opening.type) {
    case 'door':
      return [0, opening.head ?? plan.heights.door];
    case 'passage':
      return [0, plan.heights.door];
    case 'window':
      return [opening.sill, opening.head];
    default:
      return [0, clear];
  }
}

/** Whether the plan's cut passes through the opening (a high window stays above it). */
export const isCut = (opening: Opening, plan: Plan, clear: number) => {
  const [bottom, top] = openingHeights(opening, plan, clear);
  return bottom < CUT_HEIGHT && top > CUT_HEIGHT;
};

/** The opening's span along its wall, in plan coordinates. */
export function openingSpan(wall: Wall, opening: Opening): Range {
  const start = runsAlongX(wall) ? wall.x[0] : wall.z[0];
  return [start + opening.at, start + opening.at + opening.width];
}

/** The part of a wall between `from` and `to` along its run. */
export function slice(wall: Rect, from: number, to: number): Rect {
  return runsAlongX(wall) ? { x: [from, to], z: wall.z } : { x: wall.x, z: [from, to] };
}

/** The wall's run minus the given spans. */
function solidRuns(wall: Wall, holes: Range[]): Range[] {
  const [start, end] = runsAlongX(wall) ? wall.x : wall.z;
  const runs: Range[] = [];
  let cursor = start;
  for (const [a, b] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (a > cursor + EPS) runs.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (end > cursor + EPS) runs.push([cursor, end]);
  return runs;
}

/** What the plan's cut finds solid in a wall: the poché. */
export function cutPieces(wall: Wall, plan: Plan, clear: number): Rect[] {
  if (wall.kind === 'glazing') return [];
  const holes = (wall.openings ?? []).filter((opening) => isCut(opening, plan, clear)).map((opening) => openingSpan(wall, opening));
  return solidRuns(wall, holes).map(([a, b]) => slice(wall, a, b));
}

/** A box of wall, in plan coordinates plus heights above the level's floor. */
export interface WallBlock {
  rect: Rect;
  y: Range;
}

/** The wall as built: full-height runs between openings, plus the sills and lintels around them. */
export function wallBlocks(wall: Wall, plan: Plan, clear: number): WallBlock[] {
  if (wall.kind === 'glazing') return [];
  const openings = wall.openings ?? [];
  const blocks: WallBlock[] = solidRuns(
    wall,
    openings.map((opening) => openingSpan(wall, opening)),
  ).map(([a, b]) => ({ rect: slice(wall, a, b), y: [0, clear] }));
  for (const opening of openings) {
    const [a, b] = openingSpan(wall, opening);
    const [bottom, top] = openingHeights(opening, plan, clear);
    if (bottom > EPS) blocks.push({ rect: slice(wall, a, b), y: [0, bottom] });
    if (top < clear - EPS) blocks.push({ rect: slice(wall, a, b), y: [top, clear] });
  }
  return blocks;
}

/** A door leaf standing open at right angles, and the arc its edge sweeps. */
export function doorSwing(wall: Wall, opening: Extract<Opening, { type: 'door' }>) {
  const [a, b] = openingSpan(wall, opening);
  const hinge = opening.hinge === 'min' ? a : b;
  const free = opening.hinge === 'min' ? b : a;
  const alongX = runsAlongX(wall);
  const across = alongX ? wall.z : wall.x;
  const face = opening.side > 0 ? across[1] : across[0];
  const tip = face + opening.side * opening.width;
  const point = (along: number, off: number): Point => (alongX ? [along, off] : [off, along]);
  return {
    hinge: point(hinge, face),
    /** The open leaf's free edge. */
    tip: point(hinge, tip),
    /** Where the closed leaf's free edge meets the jamb. */
    jamb: point(free, face),
    radius: opening.width,
  };
}

export interface StairGeometry {
  rise: number;
  tread: number;
  treads: number;
  /** 2R + T, Blondel's step rule; comfortable between 0.60 and 0.65 m. */
  blondel: number;
  /** Plan positions of each riser along the run, bottom first. */
  risers: number[];
}

export function stairGeometry(stair: Stair, floorToFloor: number): StairGeometry {
  const alongX = stair.up === 'e' || stair.up === 'w';
  const [start, end] = alongX ? stair.x : stair.z;
  const ascending = stair.up === 'e' || stair.up === 'n';
  const treads = stair.risers - 1;
  const tread = (end - start) / treads;
  const rise = floorToFloor / stair.risers;
  const risers = Array.from({ length: stair.risers }, (_, i) => (ascending ? start + i * tread : end - i * tread));
  return { rise, tread, treads, blondel: 2 * rise + tread, risers };
}

/* ------------------------------------------------------------------------ */
/* The drawing                                                              */
/* ------------------------------------------------------------------------ */

/**
 * Line weights, as on a drafted sheet: `cut` outlines what the plan cuts,
 * `beyond` what is seen below the cut, `thin` fittings and fixtures, `hair`
 * axes, dimensions and hatching.
 */
export type Weight = 'cut' | 'beyond' | 'thin' | 'hair';

/**
 * The three inks a sheet is drawn in, in the order the drafter lays them:
 * the walls the plan cuts, then the lines of what is seen, then the notes.
 */
export type Ink = 'cut' | 'line' | 'note';

export type Dash = 'dashed' | 'axis';

export interface Stroke {
  ink: Ink;
  weight: Weight;
  points: Point[];
  closed?: boolean;
  dash?: Dash;
}

export interface Arc {
  ink: Ink;
  weight: Weight;
  centre: Point;
  radius: number;
  /** Angles in the plan's x-z plane, radians. */
  from: number;
  to: number;
}

export interface Label {
  ink: Ink;
  at: Point;
  text: string;
  /** Cap height of the text, metres on the ground. */
  size: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Spaced capitals, as titles and room names are lettered. */
  tracking?: number;
  /** Turned a quarter, reading upwards: the text of a dimension string that runs north-south. */
  quarter?: boolean;
}

export interface PlanDrawing {
  /** Cut concrete: solid poché. */
  poche: Rect[];
  /** Cut brick partitions: outlined and hatched. */
  hatch: Rect[];
  strokes: Stroke[];
  arcs: Arc[];
  /** Filled triangles: arrowheads and the north point. */
  solids: { ink: Ink; points: [Point, Point, Point] }[];
  circles: { ink: Ink; weight: Weight; centre: Point; radius: number }[];
  labels: Label[];
}

const TEXT = { room: 0.24, area: 0.18, level: 0.16, dim: 0.22, axis: 0.3, title: 0.52, note: 0.2, small: 0.15 };
const ROOM_TRACKING = 0.04;
/** Room labels keep this far from the room's walls. */
const ROOM_MARGIN = 0.15;

/** Every number in the Spanish way: a decimal comma. */
const fmt = (value: number) => value.toFixed(2).replace('.', ',');
const fmtArea = (value: number) => `${fmt(value)} m²`;
const fmtLevel = (value: number) => (Math.abs(value) < 0.005 ? 'NPT ±0,00' : `NPT ${value > 0 ? '+' : '−'}${fmt(Math.abs(value))}`);

/** DM Sans advance widths in cap heights, on the generous side: narrow marks, capitals, everything else. */
const NARROW = /[\s.,:;·'!|iIl1]/u;
const ADVANCE = { narrow: 0.35, capital: 0.92, other: 0.78 };

/**
 * Where a label's ink lands, estimated from DM Sans' advance widths, so a
 * drawing can be checked for collisions without a canvas.
 */
export function labelBox(label: Label): Rect {
  const tracking = (label.tracking ?? 0) / 0.7;
  const advances = [...label.text].map((char) =>
    NARROW.test(char) ? ADVANCE.narrow : /\p{Lu}/u.test(char) ? ADVANCE.capital : ADVANCE.other,
  );
  const width = advances.reduce((sum, advance) => sum + advance + tracking, 0) * label.size;
  const align = label.align ?? 'left';
  const start = align === 'left' ? 0 : align === 'center' ? -width / 2 : -width;
  const [x, z] = label.at;
  // Reading upwards, the text runs south and its letters stand west of the baseline.
  if (label.quarter) return { x: [x - label.size, x], z: [z - start - width, z - start] };
  return { x: [x + start, x + start + width], z: [z - label.size, z] };
}

function rectStroke(rect: Rect, ink: Ink, weight: Weight, dash?: Dash): Stroke {
  const [x0, x1] = rect.x;
  const [z0, z1] = rect.z;
  return {
    ink,
    weight,
    dash,
    closed: true,
    points: [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
  };
}

const line = (ink: Ink, weight: Weight, a: Point, b: Point, dash?: Dash): Stroke => ({ ink, weight, points: [a, b], dash });

/** A dimension string: a line with a tick at every station and each span written above it. */
function dimensionString(drawing: PlanDrawing, stations: number[], along: 'x' | 'z', at: number, reach: number) {
  const point = (s: number, o: number): Point => (along === 'x' ? [s, o] : [o, s]);
  const sorted = [...stations].sort((a, b) => a - b);
  drawing.strokes.push(line('note', 'hair', point(sorted[0] - 0.25, at), point(sorted.at(-1)! + 0.25, at)));
  const tick = 0.13;
  for (const s of sorted) {
    // Extension line from near the building out past the dimension line; a negative reach dimensions the west or south side.
    drawing.strokes.push(line('note', 'hair', point(s, at - reach), point(s, at + Math.sign(reach) * 0.18)));
    // The architect's tick: a short slash at 45 degrees.
    drawing.strokes.push(
      line('note', 'beyond', along === 'x' ? [s - tick, at + tick] : [at - tick, s - tick], along === 'x' ? [s + tick, at - tick] : [at + tick, s + tick]),
    );
  }
  // Each span written just off the line: above it along x, turned to read upwards along z.
  for (let i = 1; i < sorted.length; i++) {
    const span = sorted[i] - sorted[i - 1];
    if (span < 0.05) continue;
    const mid = (sorted[i] + sorted[i - 1]) / 2;
    drawing.labels.push({
      ink: 'note',
      at: along === 'x' ? [mid, at - 0.12] : [at - 0.15, mid],
      text: fmt(span),
      size: TEXT.dim,
      align: 'center',
      quarter: along === 'z',
    });
  }
}

/** Glyphs for furniture and fittings, drawn thin inside their rect. */
function fixtureStrokes(drawing: PlanDrawing, fixture: Fixture) {
  const { rect, kind, facing } = fixture;
  const [x0, x1] = rect.x;
  const [z0, z1] = rect.z;
  const [cx, cz] = centre(rect);
  const w = x1 - x0;
  const d = z1 - z0;
  const push = (stroke: Stroke) => drawing.strokes.push(stroke);
  const outline = () => push(rectStroke(rect, 'line', 'thin'));
  /** A rect inset from the fixture's own. */
  const inset = (by: number): Rect => ({ x: [x0 + by, x1 - by], z: [z0 + by, z1 - by] });
  /** Back edge offset `by` from the side the fixture faces away from. */
  const back = (by: number) => {
    if (facing === 'n') return line('line', 'thin', [x0, z0 + by], [x1, z0 + by]);
    if (facing === 's') return line('line', 'thin', [x0, z1 - by], [x1, z1 - by]);
    if (facing === 'e') return line('line', 'thin', [x0 + by, z0], [x0 + by, z1]);
    return line('line', 'thin', [x1 - by, z0], [x1 - by, z1]);
  };
  const circle = (centreAt: Point, radius: number) => drawing.circles.push({ ink: 'line', weight: 'thin', centre: centreAt, radius });

  switch (kind) {
    case 'counter':
    case 'island':
    case 'desk':
      outline();
      break;
    case 'tall':
      outline();
      push(line('line', 'hair', [x0, z0], [x1, z1]));
      push(line('line', 'hair', [x1, z0], [x0, z1]));
      break;
    case 'wardrobe':
      // A wardrobe (placard): its box, the line of its doors and a long diagonal.
      outline();
      push(back(0.05));
      push(line('line', 'hair', [x0, z0], [x1, z1]));
      break;
    case 'sink':
      push(rectStroke(inset(0.06), 'line', 'thin'));
      circle([cx, cz], 0.035);
      break;
    case 'cooktop': {
      const r = Math.min(w, d) * 0.16;
      for (const [fx, fz] of [
        [0.3, 0.3],
        [0.7, 0.3],
        [0.3, 0.7],
        [0.7, 0.7],
      ])
        circle([x0 + w * fx, z0 + d * fz], r);
      break;
    }
    case 'wc': {
      // Tank against the wall, bowl pointing the way the user faces.
      const vertical = facing === 'n' || facing === 's';
      const tank = 0.2;
      if (vertical) {
        const tz: Range = facing === 'n' ? [z0, z0 + tank] : [z1 - tank, z1];
        push(rectStroke({ x: [x0, x1], z: tz }, 'line', 'thin'));
        const bowlZ = facing === 'n' ? z0 + tank + (d - tank) / 2 : z1 - tank - (d - tank) / 2;
        drawing.arcs.push({ ink: 'line', weight: 'thin', centre: [cx, bowlZ], radius: Math.min(w / 2, (d - tank) / 2), from: 0, to: Math.PI * 2 });
      } else {
        const tx: Range = facing === 'e' ? [x0, x0 + tank] : [x1 - tank, x1];
        push(rectStroke({ x: tx, z: [z0, z1] }, 'line', 'thin'));
        const bowlX = facing === 'e' ? x0 + tank + (w - tank) / 2 : x1 - tank - (w - tank) / 2;
        drawing.arcs.push({ ink: 'line', weight: 'thin', centre: [bowlX, cz], radius: Math.min(d / 2, (w - tank) / 2), from: 0, to: Math.PI * 2 });
      }
      break;
    }
    case 'basin':
      outline();
      drawing.arcs.push({ ink: 'line', weight: 'thin', centre: [cx, cz], radius: Math.min(w, d) * 0.32, from: 0, to: Math.PI * 2 });
      break;
    case 'shower':
      outline();
      push(line('line', 'hair', [x0, z0], [x1, z1]));
      push(line('line', 'hair', [x1, z0], [x0, z1]));
      circle([cx, cz], 0.05);
      break;
    case 'tub':
    case 'bath':
      outline();
      push(rectStroke(inset(0.08), 'line', 'thin'));
      break;
    case 'washer':
      outline();
      circle([cx, cz], Math.min(w, d) * 0.36);
      break;
    case 'table': {
      outline();
      const seats = fixture.seats ?? 0;
      const alongX = w >= d;
      const chair = 0.42;
      for (let i = 0; i < seats; i++) {
        const t = (i + 0.5) / seats;
        if (alongX) {
          const sx = x0 + w * t;
          push(rectStroke({ x: [sx - chair / 2, sx + chair / 2], z: [z0 - 0.5, z0 - 0.08] }, 'line', 'thin'));
          push(rectStroke({ x: [sx - chair / 2, sx + chair / 2], z: [z1 + 0.08, z1 + 0.5] }, 'line', 'thin'));
        } else {
          const sz = z0 + d * t;
          push(rectStroke({ x: [x0 - 0.5, x0 - 0.08], z: [sz - chair / 2, sz + chair / 2] }, 'line', 'thin'));
          push(rectStroke({ x: [x1 + 0.08, x1 + 0.5], z: [sz - chair / 2, sz + chair / 2] }, 'line', 'thin'));
        }
      }
      break;
    }
    case 'sofa':
    case 'armchair':
      outline();
      push(back(0.22));
      break;
    case 'bed': {
      outline();
      // Pillows at the head, against the wall the bed's foot points away from.
      const vertical = facing === 'n' || facing === 's';
      const pillow = 0.32;
      const pillows = (vertical ? w : d) > 1.3 ? 2 : 1;
      for (let i = 0; i < pillows; i++) {
        const t0 = (i / pillows) * (vertical ? w : d) + 0.08;
        const t1 = ((i + 1) / pillows) * (vertical ? w : d) - 0.08;
        if (vertical) {
          const pz: Range = facing === 'n' ? [z0 + 0.08, z0 + 0.08 + pillow] : [z1 - 0.08 - pillow, z1 - 0.08];
          push(rectStroke({ x: [x0 + t0, x0 + t1], z: pz }, 'line', 'hair'));
        } else {
          const px: Range = facing === 'e' ? [x0 + 0.08, x0 + 0.08 + pillow] : [x1 - 0.08 - pillow, x1 - 0.08];
          push(rectStroke({ x: px, z: [z0 + t0, z0 + t1] }, 'line', 'hair'));
        }
      }
      push(back(vertical ? d * 0.38 : w * 0.38));
      break;
    }
  }
}

function openingStrokes(drawing: PlanDrawing, wall: Wall, opening: Opening, plan: Plan, clear: number) {
  const alongX = runsAlongX(wall);
  const [a, b] = openingSpan(wall, opening);
  const across = alongX ? wall.z : wall.x;
  const mid = (across[0] + across[1]) / 2;
  const p = (along: number, off: number): Point => (alongX ? [along, off] : [off, along]);
  const seg = (s0: number, o0: number, s1: number, o1: number, weight: Weight = 'thin', dash?: Dash) =>
    drawing.strokes.push(line('line', weight, p(s0, o0), p(s1, o1), dash));

  if (!isCut(opening, plan, clear)) {
    // Above the cut: a high window, dashed along the wall's middle.
    seg(a, mid - 0.04, b, mid - 0.04, 'hair', 'dashed');
    seg(a, mid + 0.04, b, mid + 0.04, 'hair', 'dashed');
    return;
  }
  switch (opening.type) {
    case 'door': {
      const swing = doorSwing(wall, opening);
      drawing.strokes.push(line('line', 'beyond', swing.hinge, swing.tip));
      const angleOf = (pt: Point) => Math.atan2(pt[1] - swing.hinge[1], pt[0] - swing.hinge[0]);
      let from = angleOf(swing.tip);
      let to = angleOf(swing.jamb);
      // The quarter turn between the open leaf and the jamb, never the long way round.
      if (to - from > Math.PI) to -= Math.PI * 2;
      if (from - to > Math.PI) from -= Math.PI * 2;
      drawing.arcs.push({ ink: 'line', weight: 'hair', centre: swing.hinge, radius: swing.radius, from: Math.min(from, to), to: Math.max(from, to) });
      break;
    }
    case 'passage':
      // The lintel above, dashed across the opening at both faces.
      seg(a, across[0], b, across[0], 'hair', 'dashed');
      seg(a, across[1], b, across[1], 'hair', 'dashed');
      break;
    case 'window': {
      // Sill at both faces, the glass as a pair of lines in the middle, a frame at each mullion.
      seg(a, across[0], b, across[0]);
      seg(a, across[1], b, across[1]);
      seg(a, mid - 0.025, b, mid - 0.025, 'hair');
      seg(a, mid + 0.025, b, mid + 0.025, 'hair');
      for (const m of [0, ...(opening.mullions ?? []), opening.width]) {
        seg(a + m, mid - 0.06, a + m, mid + 0.06, 'thin');
      }
      break;
    }
    case 'glass':
      seg(a, mid - 0.025, b, mid - 0.025, 'thin');
      seg(a, mid + 0.025, b, mid + 0.025, 'thin');
      seg(a, mid - 0.06, a, mid + 0.06, 'thin');
      seg(b, mid - 0.06, b, mid + 0.06, 'thin');
      break;
    case 'slider': {
      // Leaves on two tracks, each overlapping the next.
      const leaf = (b - a) / opening.leaves;
      const overlap = 0.06;
      for (let i = 0; i < opening.leaves; i++) {
        const track = i % 2 === 0 ? -0.035 : 0.035;
        const s0 = a + i * leaf - (i > 0 ? overlap / 2 : 0);
        const s1 = a + (i + 1) * leaf + (i < opening.leaves - 1 ? overlap / 2 : 0);
        drawing.strokes.push({
          ink: 'line',
          weight: 'thin',
          closed: true,
          points: [p(s0, mid + track - 0.02), p(s1, mid + track - 0.02), p(s1, mid + track + 0.02), p(s0, mid + track + 0.02)],
        });
      }
      seg(a, across[0], b, across[0], 'hair');
      seg(a, across[1], b, across[1], 'hair');
      break;
    }
  }
}

/** The stair as the plan sees it from this level: treads up to the cut, the break line, the walking line. */
function stairStrokes(drawing: PlanDrawing, stair: Stair, floorToFloor: number) {
  const geometry = stairGeometry(stair, floorToFloor);
  const alongX = stair.up === 'e' || stair.up === 'w';
  const across = alongX ? stair.z : stair.x;
  const p = (along: number, off: number): Point => (alongX ? [along, off] : [off, along]);
  const cutRiser = Math.ceil(CUT_HEIGHT / geometry.rise);
  const direction = stair.up === 'e' || stair.up === 'n' ? 1 : -1;
  const cutAt = geometry.risers[0] + direction * (cutRiser - 0.5) * geometry.tread;

  geometry.risers.forEach((s, i) => {
    const above = i >= cutRiser;
    drawing.strokes.push(line('line', above ? 'hair' : 'thin', p(s, across[0]), p(s, across[1]), above ? 'dashed' : undefined));
  });
  // The stringer along the open side.
  drawing.strokes.push(line('line', 'thin', p(geometry.risers[0], across[1]), p(geometry.risers.at(-1)!, across[1])));
  // The break line, drawn at an angle across the flight where the plan cuts it.
  const width = across[1] - across[0];
  const skew = width * 0.45 * direction;
  drawing.strokes.push({
    ink: 'line',
    weight: 'beyond',
    points: [
      p(cutAt - skew, across[0]),
      p(cutAt - skew * 0.1, across[0] + width * 0.45),
      p(cutAt + skew * 0.1, across[0] + width * 0.55),
      p(cutAt + skew, across[1]),
    ],
  });
  // Walking line from the first riser to the break, ending in an arrow; "SUBE" beside its start.
  const middle = (across[0] + across[1]) / 2;
  const start = geometry.risers[0] - direction * 0.12;
  const end = cutAt - direction * 0.25;
  drawing.circles.push({ ink: 'note', weight: 'thin', centre: p(start, middle), radius: 0.06 });
  drawing.strokes.push(line('note', 'thin', p(start, middle), p(end, middle)));
  const head = 0.28;
  drawing.solids.push({
    ink: 'note',
    points: [p(end + direction * head, middle), p(end, middle - 0.1), p(end, middle + 0.1)],
  });
  // "SUBE" between the walking line and the wall, the first and last risers numbered, and the
  // riser note off the flight, where it does not letter over the treads.
  drawing.labels.push({
    ink: 'note',
    at: p(geometry.risers[0] + direction * 1.1, across[0] + 0.33),
    text: 'SUBE',
    size: TEXT.note * 0.8,
    bold: true,
    align: 'center',
    tracking: 0.12,
  });
  // Each number on the tread it rises to; the last riser's, on the last tread, before it reaches the landing.
  const last = stair.risers - 1;
  for (const i of [0, last]) {
    drawing.labels.push({
      ink: 'note',
      at: p(geometry.risers[i] + (direction * geometry.tread * (i === last ? -1 : 1)) / 2, across[1] - 0.1),
      text: `${i + 1}`,
      size: TEXT.small,
      align: 'center',
    });
  }
  const run = (geometry.risers[0] + geometry.risers.at(-1)!) / 2;
  drawing.labels.push({
    ink: 'note',
    at: p(run, across[1] + 0.55),
    text: `${stair.risers} alz. ${(geometry.rise * 100).toFixed(1).replace('.', ',')} / ${geometry.treads} pis. ${Math.round(geometry.tread * 100)}`,
    size: TEXT.note * 0.85,
    align: 'center',
  });
}

function northPoint(drawing: PlanDrawing, at: Point) {
  const r = 0.55;
  drawing.circles.push({ ink: 'note', weight: 'thin', centre: at, radius: r });
  // North is +z: the arrow points at the garden.
  const [x, z] = at;
  drawing.solids.push({ ink: 'note', points: [[x, z + r * 0.95], [x - r * 0.32, z - r * 0.55], [x, z - r * 0.25]] });
  drawing.strokes.push({ ink: 'note', weight: 'thin', closed: true, points: [[x, z + r * 0.95], [x + r * 0.32, z - r * 0.55], [x, z - r * 0.25]] });
  drawing.labels.push({ ink: 'note', at: [x, z + r + 0.42], text: 'N', size: TEXT.axis, bold: true, align: 'center' });
}

function scaleBar(drawing: PlanDrawing, at: Point) {
  const [x, z] = at;
  const marks = [0, 1, 2, 5];
  drawing.strokes.push(line('note', 'thin', [x, z], [x + 5, z]));
  drawing.strokes.push(line('note', 'thin', [x, z + 0.12], [x + 5, z + 0.12]));
  for (let m = 0; m < 5; m++) {
    if (m % 2 === 0) {
      drawing.strokes.push({ ink: 'note', weight: 'hair', closed: true, points: [[x + m, z], [x + m + 1, z], [x + m + 1, z + 0.12], [x + m, z + 0.12]] });
    }
  }
  // The figures over the bar, so it sits on the title's baseline.
  for (const m of marks) {
    drawing.strokes.push(line('note', 'thin', [x + m, z - 0.08], [x + m, z + 0.2]));
    drawing.labels.push({ ink: 'note', at: [x + m, z - 0.16], text: `${m}`, size: TEXT.note, align: 'center' });
  }
  drawing.labels.push({ ink: 'note', at: [x + 5.35, z + 0.12], text: 'm', size: TEXT.note, align: 'left' });
}

export interface SheetFrame {
  /** Building bounds the annotations are placed around. */
  bounds: Rect;
  /** The sheet's own extent: the plot. */
  sheet: Rect;
}

/**
 * The ground floor plan as a drafted sheet: walls cut at 1.20 m, what is
 * seen below the cut, the upper floor dashed in projection, the grid,
 * dimension strings, room names with their areas and levels, the north
 * point and a graphic scale.
 */
export function planDrawing(plan: Plan, frame: SheetFrame, levelId: LevelId = 'ground'): PlanDrawing {
  const level = plan[levelId];
  const { floor, ceiling, nivel } = levelHeights(plan, levelId);
  const clear = ceiling - floor;
  const drawing: PlanDrawing = { poche: [], hatch: [], strokes: [], arcs: [], solids: [], circles: [], labels: [] };

  // What the plan cuts: walls, the blade and the columns.
  for (const wall of level.walls) {
    const pieces = cutPieces(wall, plan, clear);
    (wall.kind === 'concrete' ? drawing.poche : drawing.hatch).push(...pieces);
    for (const opening of wall.openings ?? []) openingStrokes(drawing, wall, opening, plan, clear);
  }
  drawing.poche.push({ x: plan.blade.x, z: plan.blade.z });
  const half = plan.column / 2;
  for (const [x, z] of level.columns) drawing.poche.push({ x: [x - half, x + half], z: [z - half, z + half] });

  // What is seen below the cut: the slab edge, the galería paving, the stair, the rails, the fittings.
  drawing.strokes.push(rectStroke(level.slab, 'line', 'beyond'));
  if (levelId === 'ground') drawing.strokes.push(rectStroke(plan.galeria, 'line', 'beyond'));
  if (level.stair) stairStrokes(drawing, level.stair, levelHeights(plan, 'upper').floor - floor);
  for (const rail of level.rails ?? []) drawing.strokes.push(rectStroke(rail, 'line', 'thin'));
  for (const fixture of level.fixtures) fixtureStrokes(drawing, fixture);

  // Above the cut, dashed: the upper floor over the ground floor, its cantilever, and the canopy over the front door.
  // From the upper floor the canopy is seen below.
  if (levelId === 'ground') drawing.strokes.push(rectStroke(plan.upper.slab, 'line', 'beyond', 'dashed'));
  drawing.strokes.push(rectStroke(plan.canopy, 'line', 'beyond', levelId === 'ground' ? 'dashed' : undefined));

  if (levelId === 'ground') {
    drawing.labels.push({
      ink: 'note',
      at: [plan.upper.slab.x[1] - 0.25, plan.upper.slab.z[0] + 0.5],
      text: `PROYECCIÓN LOSA P. ALTA · POSTESADA e=${fmt(plan.heights.structure)}`,
      size: TEXT.small,
      align: 'right',
    });
  }
  // The blade's note on the street side, past its south wing and the canopy, clear of the first axis.
  const { blade } = plan;
  drawing.labels.push({
    ink: 'note',
    at: [plan.grid.x[0].at + 0.3, blade.z[0] - 0.1],
    text: `MURO H° VISTO e ${fmt(length(blade.x))} · h +${fmt(blade.height)}`,
    size: TEXT.small,
    align: 'left',
  });

  // The grid: dash-dot axes through the columns, numbered in bubbles on the street side,
  // lettered at the east end, clear of the title block in the front corner. On the garden
  // side the axes run out to the dimension strings, which clear the blade's north wing.
  const { bounds } = frame;
  const garden = Math.max(bounds.z[1], blade.z[1]) + 0.15;
  const bubble = 0.36;
  const xAxisEnd = bounds.z[0] - 2.3;
  const zAxisEnd = bounds.x[1] + 1.75;
  for (const axis of plan.grid.x) {
    drawing.strokes.push(line('note', 'hair', [axis.at, garden], [axis.at, xAxisEnd + bubble], 'axis'));
    drawing.circles.push({ ink: 'note', weight: 'thin', centre: [axis.at, xAxisEnd], radius: bubble });
    drawing.labels.push({ ink: 'note', at: [axis.at, xAxisEnd + 0.15], text: axis.id, size: TEXT.axis, align: 'center' });
  }
  for (const axis of plan.grid.z) {
    drawing.strokes.push(line('note', 'hair', [bounds.x[0] - 0.6, axis.at], [zAxisEnd - bubble, axis.at], 'axis'));
    drawing.circles.push({ ink: 'note', weight: 'thin', centre: [zAxisEnd, axis.at], radius: bubble });
    drawing.labels.push({ ink: 'note', at: [zAxisEnd, axis.at + 0.15], text: axis.id, size: TEXT.axis, align: 'center' });
  }

  // Dimension strings, three deep on the garden side and on the east end: axis to axis,
  // then face to face (the bar and its cantilever), then overall.
  const { ground, upper } = plan;
  const west = Math.min(ground.slab.x[0], upper.slab.x[0]);
  const east = Math.max(ground.slab.x[1], upper.slab.x[1]);
  const front = Math.max(ground.slab.z[1], upper.slab.z[1]);
  dimensionString(drawing, [...plan.grid.x.map((axis) => axis.at), east], 'x', garden + 0.25, 0.25);
  dimensionString(drawing, [...new Set([ground.slab.x[0], ground.slab.x[1], upper.slab.x[1]])], 'x', garden + 0.7, 0.3);
  dimensionString(drawing, [west, east], 'x', garden + 1.15, 0.25);
  dimensionString(drawing, plan.grid.z.map((axis) => axis.at), 'z', bounds.x[1] + 0.35, 0.3);
  dimensionString(drawing, [...new Set([ground.slab.z[0], upper.slab.z[1], ground.slab.z[1]])], 'z', bounds.x[1] + 0.8, 0.25);
  dimensionString(drawing, [Math.min(ground.slab.z[0], upper.slab.z[0]), front], 'z', bounds.x[1] + 1.25, 0.25);
  // On the west, the blade and how far it runs past the house at each end.
  dimensionString(drawing, [blade.z[0], ground.slab.z[0], ground.slab.z[1], blade.z[1]], 'z', blade.x[0] - 1.0, -0.75);

  // Room names, with the area under them and the level where the floor sets one. A name wider
  // than its room, or running into its fittings, is abbreviated, and an area that does not fit is left off.
  for (const room of level.rooms) {
    const [x, z] = room.label ?? centre(room.rect);
    const roomWidth = length(room.rect.x) - 2 * ROOM_MARGIN;
    const fits = (label: Label) => length(labelBox(label).x) <= roomWidth;
    const clear = (label: Label) => !level.fixtures.some((fixture) => overlaps(labelBox(label), fixture.rect));
    const name: Label = { ink: 'note', at: [x, z - 0.04], text: room.name.toUpperCase(), size: TEXT.room, bold: true, align: 'center', tracking: ROOM_TRACKING };
    if (!(fits(name) && clear(name)) && room.abbr) name.text = room.abbr.toUpperCase();
    drawing.labels.push(name);
    const areaLabel: Label = { ink: 'note', at: [x, z + 0.24], text: fmtArea(area(room.rect)), size: TEXT.area, align: 'center' };
    if (fits(areaLabel)) drawing.labels.push(areaLabel);
    if (room.npt || room.semicovered) {
      const roomLevel = room.semicovered ? nivel - 0.05 : nivel;
      drawing.labels.push({ ink: 'note', at: [x, z + 0.48], text: fmtLevel(roomLevel), size: TEXT.level, align: 'center' });
    }
  }

  // Title with the graphic scale beside it, and the north point, in the plot's front corners.
  const { sheet } = frame;
  const title: Label = { ink: 'note', at: [sheet.x[0] + 0.9, sheet.z[1] - 0.3], text: level.name.toUpperCase(), size: TEXT.title, bold: true, align: 'left', tracking: 0.14 };
  drawing.labels.push(title);
  scaleBar(drawing, [labelBox(title).x[1] + 0.8, sheet.z[1] - 0.42]);
  northPoint(drawing, [sheet.x[1] - 1.3, sheet.z[1] - 1.5]);

  return drawing;
}
