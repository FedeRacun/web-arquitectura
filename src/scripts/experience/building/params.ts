/*
 * The procedural building as plain numbers: boxes tagged with their exploded
 * layer and their material, the three volumes it is composed of, and the
 * edges the sketch draws. No three.js here, so the composition can be tested
 * and re-proportioned per architect from the config alone.
 *
 * Axes: x along the site's width, y up, z towards the viewer (the front).
 * The composition: a glazed ground floor (base), an upper bar shifted along x
 * so it cantilevers past the base, and a free-standing concrete blade wall on
 * the left that rises above both.
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
  base: { width: number; depth: number; height: number };
  upper: { width: number; depth: number; height: number; shift: number };
  blade: { height: number; thickness: number };
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

const SLAB = 0.25;
const WALL = 0.3;
const GLASS = 0.06;
const FRAME = 0.08;
const FRAME_DEPTH = 0.14;
/** The ground floor glazing sits this far behind the base's front edge. */
const RECESS = 0.6;
/** Gap between the blade wall and the base. */
const BLADE_GAP = 1.2;
/** Sill height of the upper bar's ribbon window. */
const SILL = 1;
const LINTEL = 0.65;

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({
  min: [x0, y0, z0],
  max: [x1, y1, z1],
});

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
  const { base, upper, blade } = config;
  const span = Math.max(base.width, upper.shift + upper.width);
  const x0 = -span / 2;

  const baseBox = box(x0, x0 + base.width, 0, base.height, -base.depth / 2, base.depth / 2);
  const top = base.height + upper.height;
  const upperBox = box(
    x0 + upper.shift,
    x0 + upper.shift + upper.width,
    base.height,
    top,
    -base.depth / 2,
    -base.depth / 2 + upper.depth,
  );
  const bladeX1 = x0 - BLADE_GAP;
  const bladeBox = box(bladeX1 - blade.thickness, bladeX1, 0, blade.height, -base.depth / 2 - 1.5, base.depth / 2 + 1.5);

  const [ax0, , az0] = baseBox.min;
  const [ax1, ah, az1] = baseBox.max;
  const [bx0, by0, bz0] = upperBox.min;
  const [bx1, , bz1] = upperBox.max;

  const parts: Part[] = [];
  const add = (layer: LayerId, kind: MaterialKind, b: Box) => parts.push({ layer, kind, box: b });

  // Estructura: slabs and the columns behind the ground floor glass.
  add('estructura', 'concrete', box(ax0, ax1, 0, SLAB, az0, az1));
  add('estructura', 'concrete', box(ax0, ax1, ah - SLAB, ah, az0, az1));
  if (bx1 > ax1) add('estructura', 'concrete', box(ax1, bx1, ah - SLAB, ah, bz0, bz1));
  const columnZ = az1 - RECESS - 0.6;
  for (const x of divisions(ax0, ax1, detail === 'full' ? 3 : 6)) {
    add('estructura', 'concrete', box(x - 0.125, x + 0.125, SLAB, ah - SLAB, columnZ - 0.125, columnZ + 0.125));
  }

  // Envolvente: the concrete walls and the blade.
  const lintelBottom = top - SLAB - LINTEL;
  add('envolvente', 'concrete', box(ax0, ax1, SLAB, ah - SLAB, az0, az0 + WALL));
  add('envolvente', 'concrete', box(ax0, ax0 + WALL, SLAB, ah - SLAB, az0 + WALL, az1));
  add('envolvente', 'concrete', box(ax1 - WALL, ax1, SLAB, ah - SLAB, az0 + WALL, az1));
  add('envolvente', 'concrete', box(bx0, bx1, by0, top - SLAB, bz0, bz0 + WALL));
  add('envolvente', 'concrete', box(bx0, bx0 + WALL, by0, top - SLAB, bz0 + WALL, bz1));
  add('envolvente', 'concrete', box(bx0 + WALL, bx1, by0, by0 + SILL, bz1 - WALL, bz1));
  add('envolvente', 'concrete', box(bx0 + WALL, bx1, lintelBottom, top - SLAB, bz1 - WALL, bz1));
  add('envolvente', 'concrete', box(bx0 + WALL, bx0 + 1.2, by0 + SILL, lintelBottom, bz1 - WALL, bz1));
  add('envolvente', 'concrete', box(bx1 - 0.9, bx1, by0 + SILL, lintelBottom, bz1 - WALL, bz1));
  add('envolvente', 'concrete', bladeBox);

  // Luz: carpentry in wood and the glass it holds.
  const glazingZ = az1 - RECESS;
  add('luz', 'glass', box(ax0 + WALL, ax1 - WALL, SLAB, ah - SLAB, glazingZ - GLASS / 2, glazingZ + GLASS / 2));
  const frameZ = (z: number): [number, number] => [z - FRAME_DEPTH / 2, z + FRAME_DEPTH / 2];
  for (const x of divisions(ax0 + WALL, ax1 - WALL, detail === 'full' ? 1.5 : 3)) {
    add('luz', 'wood', box(x - FRAME / 2, x + FRAME / 2, SLAB, ah - SLAB, ...frameZ(glazingZ)));
  }
  add('luz', 'wood', box(ax0 + WALL, ax1 - WALL, ah - SLAB - 0.12, ah - SLAB, ...frameZ(glazingZ)));
  add('luz', 'wood', box(ax0 + WALL, ax1 - WALL, SLAB, SLAB + 0.08, ...frameZ(glazingZ)));

  const ribbonZ = bz1 - WALL / 2;
  const ribbonX0 = bx0 + 1.2;
  const ribbonX1 = bx1 - 0.9;
  add('luz', 'glass', box(ribbonX0, ribbonX1, by0 + SILL, lintelBottom, ribbonZ - GLASS / 2, ribbonZ + GLASS / 2));
  for (const x of divisions(ribbonX0, ribbonX1, detail === 'full' ? 2 : 4)) {
    add('luz', 'wood', box(x - FRAME / 2, x + FRAME / 2, by0 + SILL, lintelBottom, ...frameZ(ribbonZ)));
  }

  // The cantilevered end is glazed floor to ceiling: a framed view.
  const endX = bx1 - WALL / 2;
  const endX0 = endX - FRAME_DEPTH / 2;
  const endX1 = endX + FRAME_DEPTH / 2;
  add('luz', 'glass', box(endX - GLASS / 2, endX + GLASS / 2, by0, top - SLAB, bz0 + WALL, bz1 - WALL));
  for (const z of [bz0 + WALL + FRAME / 2, ...divisions(bz0 + WALL, bz1 - WALL, detail === 'full' ? 2.4 : 7), bz1 - WALL - FRAME / 2]) {
    add('luz', 'wood', box(endX0, endX1, by0, top - SLAB, z - FRAME / 2, z + FRAME / 2));
  }
  add('luz', 'wood', box(endX0, endX1, lintelBottom - FRAME / 2, lintelBottom + FRAME / 2, bz0 + WALL, bz1 - WALL));

  // Habitar: the roof, the terrace on the base and its parapet.
  add('habitar', 'concrete', box(bx0 - 0.15, bx1 + 0.15, top - SLAB, top, bz0 - 0.15, bz1 + 0.15));
  if (bz1 < az1 - 0.2) {
    add('habitar', 'wood', box(ax0 + WALL, ax1 - WALL, ah, ah + 0.06, bz1, az1 - 0.2));
    add('habitar', 'concrete', box(ax0, ax1, ah, ah + 0.9, az1 - 0.2, az1));
  }

  const layerBounds = Object.fromEntries(
    LAYERS.map((layer) => [layer, union(parts.filter((part) => part.layer === layer).map((part) => part.box))]),
  ) as Record<LayerId, Box>;

  // The sketch: every volume's edges, the ribbon window, and two datum lines on the ground.
  const edges = [baseBox, upperBox, bladeBox].flatMap(boxEdges);
  edges.push(
    { from: [bx0 + WALL, by0 + SILL, bz1], to: [bx1, by0 + SILL, bz1], direction: 'horizontal' },
    { from: [bx0 + WALL, lintelBottom, bz1], to: [bx1, lintelBottom, bz1], direction: 'horizontal' },
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
    height: Math.max(top, blade.height),
    layerBounds,
    sketch,
  };
}
