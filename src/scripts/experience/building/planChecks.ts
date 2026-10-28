import {
  area,
  contains,
  doorSwing,
  labelBox,
  levelHeights,
  openingHeights,
  openingSpan,
  overlaps,
  runsAlongX,
  stairGeometry,
  unionArea,
  type Level,
  type LevelId,
  type Opening,
  type PlanDrawing,
  type Point,
  type Rect,
  type Room,
  type SheetPlan,
  type Wall,
} from './plan';

/*
 * The rules every plan must pass, the main house's and each project's, shared
 * by plan.test.ts and src/config/projects.test.ts. Each check returns what it
 * found wrong, one line per problem, so a test expects an empty list and a
 * failure names every offender at once. Test-only: nothing in the site
 * imports this module.
 */

const EPS = 1e-6;
const fmt = (value: number) => `${Math.round(value * 100) / 100}`;
const where = (rect: Rect) => `x ${fmt(rect.x[0])}–${fmt(rect.x[1])} z ${fmt(rect.z[0])}–${fmt(rect.z[1])}`;

/** The levels a plan has: the ground floor, and the upper floor when there is one. */
export const levelsOf = (plan: SheetPlan): LevelId[] => (plan.upper ? ['ground', 'upper'] : ['ground']);

const levelOf = (plan: SheetPlan, id: LevelId): Level => plan[id]!;

/** Floor to ceiling, clear. */
export function clearOf(plan: SheetPlan, id: LevelId) {
  const { floor, ceiling } = levelHeights(plan, id);
  return ceiling - floor;
}

/** A level's floor as rects: its footprint, or its slab. */
export const floorOf = (level: Level): readonly Rect[] => level.footprint ?? [level.slab];

const columnRects = (plan: SheetPlan, level: Level): Rect[] =>
  level.columns.map(([x, z]) => ({ x: [x - plan.column / 2, x + plan.column / 2], z: [z - plan.column / 2, z + plan.column / 2] }));

/** The part two rects share, if any. */
function clip(a: Rect, b: Rect): Rect | null {
  const x: [number, number] = [Math.max(a.x[0], b.x[0]), Math.min(a.x[1], b.x[1])];
  const z: [number, number] = [Math.max(a.z[0], b.z[0]), Math.min(a.z[1], b.z[1])];
  return x[0] < x[1] - EPS && z[0] < z[1] - EPS ? { x, z } : null;
}

/** Whether the rects together cover the whole of `rect`. */
export function coveredBy(rect: Rect, rects: readonly Rect[]) {
  const shared = rects.map((piece) => clip(rect, piece)).filter((piece): piece is Rect => piece !== null);
  return unionArea(shared) >= area(rect) - EPS;
}

/** Walls and columns of each level stand apart: no two solids overlap. */
export function solidsApart(plan: SheetPlan): string[] {
  return levelsOf(plan).flatMap((id) => {
    const level = levelOf(plan, id);
    const solids = [
      ...level.walls.map((wall) => ({ name: `wall ${where(wall)}`, rect: wall as Rect })),
      ...columnRects(plan, level).map((rect) => ({ name: `column ${where(rect)}`, rect })),
    ];
    return solids.flatMap((a, i) => solids.slice(i + 1).filter((b) => overlaps(a.rect, b.rect)).map((b) => `${id}: ${a.name} overlaps ${b.name}`));
  });
}

/**
 * Every wall, column, stair and room stands on its level's slab and, where
 * the level has a footprint, inside it; a footprint lies on its slab and
 * fills its bounding rect. A semicovered room may stand instead under the
 * upper floor or under the galería.
 */
export function onSlab(plan: SheetPlan): string[] {
  const problems: string[] = [];
  for (const id of levelsOf(plan)) {
    const level = levelOf(plan, id);
    const floor = floorOf(level);
    if (level.footprint) {
      const xs = level.footprint.flatMap((rect) => rect.x);
      const zs = level.footprint.flatMap((rect) => rect.z);
      const bounds: Rect = { x: [Math.min(...xs), Math.max(...xs)], z: [Math.min(...zs), Math.max(...zs)] };
      const same = (a: readonly number[], b: readonly number[]) => a.every((value, i) => Math.abs(value - b[i]) < EPS);
      if (!same(bounds.x, level.slab.x) || !same(bounds.z, level.slab.z)) {
        problems.push(`${id}: the footprint spans ${where(bounds)}, the slab ${where(level.slab)}`);
      }
    }
    const onFloor = (rect: Rect) => contains(level.slab, rect) && coveredBy(rect, floor);
    const solids = [
      ...level.walls.map((wall) => ({ name: `wall ${where(wall)}`, rect: wall as Rect })),
      ...columnRects(plan, level).map((rect) => ({ name: `column ${where(rect)}`, rect })),
      ...(level.stair ? [{ name: `stair ${where(level.stair)}`, rect: level.stair as Rect }] : []),
    ];
    for (const { name, rect } of solids) if (!onFloor(rect)) problems.push(`${id}: ${name} is off the floor`);
    for (const room of level.rooms) {
      const under = room.semicovered
        ? [floor, ...(id === 'ground' && plan.upper ? [floorOf(plan.upper)] : []), ...(plan.galeria ? [[plan.galeria]] : [])]
        : [floor];
      const placed = room.semicovered ? under.some((cover) => coveredBy(room.rect, cover)) : onFloor(room.rect);
      if (!placed) problems.push(`${id}: room ${room.name} is off the floor`);
    }
  }
  return problems;
}

/** Every opening lies inside its wall, no two share a span, and each fits the room's height. */
export function openingsFit(plan: SheetPlan): string[] {
  const problems: string[] = [];
  for (const id of levelsOf(plan)) {
    const clear = clearOf(plan, id);
    for (const wall of levelOf(plan, id).walls) {
      const run = runsAlongX(wall) ? wall.x : wall.z;
      const spans = (wall.openings ?? []).map((opening) => openingSpan(wall, opening)).sort((a, b) => a[0] - b[0]);
      spans.forEach(([a, b], i) => {
        if (a < run[0] - EPS || b > run[1] + EPS) problems.push(`${id}: opening ${fmt(a)}–${fmt(b)} runs past wall ${where(wall)}`);
        if (i > 0 && a < spans[i - 1][1] - EPS) problems.push(`${id}: openings at ${fmt(spans[i - 1][0])} and ${fmt(a)} share a span in wall ${where(wall)}`);
      });
      for (const opening of wall.openings ?? []) {
        const [bottom, top] = openingHeights(opening, plan, clear);
        if (!(top > bottom) || top > clear + EPS) problems.push(`${id}: the ${opening.type} at ${fmt(opening.at)} in wall ${where(wall)} does not fit the room's height`);
      }
    }
  }
  return problems;
}

/** Every door leaf, standing open, clears the other walls. */
export function leavesClear(plan: SheetPlan): string[] {
  const problems: string[] = [];
  for (const id of levelsOf(plan)) {
    const walls = levelOf(plan, id).walls;
    for (const wall of walls) {
      for (const opening of wall.openings ?? []) {
        if (opening.type !== 'door') continue;
        const { hinge, tip } = doorSwing(wall, opening);
        const leaf: Rect = {
          x: [Math.min(hinge[0], tip[0]) - 0.01, Math.max(hinge[0], tip[0]) + 0.01],
          z: [Math.min(hinge[1], tip[1]) - 0.01, Math.max(hinge[1], tip[1]) + 0.01],
        };
        for (const other of walls) {
          if (other !== wall && overlaps(leaf, other)) problems.push(`${id}: the door at ${fmt(opening.at)} in wall ${where(wall)} swings into wall ${where(other)}`);
        }
      }
    }
  }
  return problems;
}

/** With an upper floor, a stair climbs to it from the ground floor in comfortable steps, under an open well. */
export function stairComfort(plan: SheetPlan): string[] {
  if (!plan.upper) return [];
  const stair = plan.ground.stair;
  if (!stair) return ['no stair climbs from the ground floor to the upper floor'];
  const steps = stairGeometry(stair, levelHeights(plan, 'upper').floor - levelHeights(plan, 'ground').floor);
  const problems: string[] = [];
  if (steps.rise > 0.18 + EPS) problems.push(`the stair rises ${fmt(steps.rise)} m a step, over 0.18`);
  if (steps.tread < 0.27 - EPS) problems.push(`the stair's treads are ${fmt(steps.tread)} m, under 0.27`);
  if (steps.blondel < 0.6 - EPS || steps.blondel > 0.65 + EPS) problems.push(`the stair's 2R + T is ${fmt(steps.blondel)} m, outside 0.60–0.65`);
  if (!(plan.upper.voids ?? []).some((well) => contains(well, { x: stair.x, z: stair.z }))) problems.push('no well in the upper floor opens over the stair');
  return problems;
}

/** Every level has at least 2.60 m from floor to ceiling. */
export function clearHeights(plan: SheetPlan): string[] {
  return levelsOf(plan)
    .filter((id) => clearOf(plan, id) < 2.6 - EPS)
    .map((id) => `${id}: ${fmt(clearOf(plan, id))} m clear, under 2.60`);
}

/** The square a door leaf sweeps, and whether a rect reaches into its quarter circle. */
export function intoSwing(rect: Rect, wall: Wall, opening: Extract<Opening, { type: 'door' }>) {
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
}

/** The labels lettered for a room: its name, area and level, stacked on the room's label point. */
function roomLabels(drawing: PlanDrawing, room: Room) {
  const [x, z] = room.label ?? [(room.rect.x[0] + room.rect.x[1]) / 2, (room.rect.z[0] + room.rect.z[1]) / 2];
  return drawing.labels.filter((label) => label.at[0] === x && label.at[1] > z - 0.2 && label.at[1] < z + 0.6);
}

/** Every room of the level is lettered inside its rect, clear of the level's fittings and door swings. */
export function labelsInRooms(level: Level, drawing: PlanDrawing): string[] {
  const problems: string[] = [];
  for (const room of level.rooms) {
    const labels = roomLabels(drawing, room);
    if (labels.length === 0) problems.push(`${room.name} is not lettered`);
    for (const label of labels) {
      const box = labelBox(label);
      if (!contains(room.rect, box)) problems.push(`${room.name}: "${label.text}" runs out of the room`);
      for (const fixture of level.fixtures) if (overlaps(box, fixture.rect)) problems.push(`${room.name}: "${label.text}" is on a ${fixture.kind}`);
      for (const wall of level.walls) {
        for (const opening of wall.openings ?? []) {
          if (opening.type === 'door' && intoSwing(box, wall, opening)) problems.push(`${room.name}: "${label.text}" is in the swing of the door in wall ${where(wall)}`);
        }
      }
    }
  }
  return problems;
}

/** No two notes of the drawing are lettered over each other. */
export function notesApart(drawing: PlanDrawing): string[] {
  const boxes = drawing.labels.map((label) => ({ text: label.text, box: labelBox(label) }));
  return boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => overlaps(a.box, b.box)).map((b) => `"${a.text}" over "${b.text}"`));
}

/** Where everything the drawing puts on paper lands. */
function marks(drawing: PlanDrawing): { what: string; box: Rect }[] {
  const around = (points: readonly Point[]): Rect => ({
    x: [Math.min(...points.map((p) => p[0])), Math.max(...points.map((p) => p[0]))],
    z: [Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[1]))],
  });
  const disc = ([x, z]: Point, r: number): Rect => ({ x: [x - r, x + r], z: [z - r, z + r] });
  return [
    ...[...drawing.poche, ...drawing.hatch].map((rect) => ({ what: `wall ${where(rect)}`, box: rect })),
    ...drawing.strokes.map((stroke) => ({ what: `${stroke.ink} stroke`, box: around(stroke.points) })),
    ...drawing.arcs.map((arc) => ({
      what: 'arc',
      box: around(Array.from({ length: 17 }, (_, i): Point => {
        const angle = arc.from + ((arc.to - arc.from) * i) / 16;
        return [arc.centre[0] + arc.radius * Math.cos(angle), arc.centre[1] + arc.radius * Math.sin(angle)];
      })),
    })),
    ...drawing.circles.map((circle) => ({ what: 'circle', box: disc(circle.centre, circle.radius) })),
    ...drawing.solids.map((solid) => ({ what: 'arrowhead', box: around(solid.points) })),
    ...drawing.labels.map((label) => ({ what: `"${label.text}"`, box: labelBox(label) })),
  ];
}

/** The whole drawing (walls, lines, notes, strings, title, north point and scale) lies on the sheet. */
export function onSheet(drawing: PlanDrawing, sheet: Rect): string[] {
  return marks(drawing)
    .filter(({ box }) => !contains(sheet, box))
    .map(({ what, box }) => `${what} at ${where(box)} runs off the sheet ${where(sheet)}`);
}

/**
 * The covered area a plan builds: each level's floor (its footprint, or its
 * slab) less its voids, plus its semicovered rooms at half.
 */
export function coveredArea(plan: SheetPlan): number {
  return levelsOf(plan).reduce((sum, id) => {
    const level = levelOf(plan, id);
    const floor = floorOf(level);
    const voids = (level.voids ?? []).flatMap((well) => floor.map((piece) => clip(well, piece)).filter((piece): piece is Rect => piece !== null));
    // A semicovered room counts at half wherever it stands: what of it lies on the floor comes off the enclosed area.
    const open = level.rooms.filter((room) => room.semicovered);
    const onFloor = open.flatMap((room) => floor.map((piece) => clip(room.rect, piece)).filter((piece): piece is Rect => piece !== null));
    const semicovered = open.reduce((half, room) => half + area(room.rect) / 2, 0);
    return sum + unionArea(floor) - unionArea(voids) - unionArea(onFloor) + semicovered;
  }, 0);
}

/** A stated area is within ±10% of the covered area the plan builds. */
export function areaMatches(stated: number, plan: SheetPlan): string[] {
  const built = coveredArea(plan);
  return Math.abs(stated - built) <= built * 0.1 + EPS ? [] : [`states ${fmt(stated)} m², the plan covers ${fmt(built)} m² (±10%: ${fmt(built * 0.9)}–${fmt(built * 1.1)})`];
}
