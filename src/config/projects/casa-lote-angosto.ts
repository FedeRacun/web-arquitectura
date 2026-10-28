import type { Rect, SheetPlan } from '../../scripts/experience/building/plan';
import type { Project } from '../projects';

/*
 * A compact two-storey house on a narrow urban lot, between party walls.
 *
 * Reference: the typology follows Casa MeMo by BAM! arquitectura (Bardach,
 * Mosquera), San Isidro, Buenos Aires, 2016,
 * https://www.archdaily.com/es/870790/casa-memo-bam-arquitectura
 * The plan is an original simplification of that typology, not a copy:
 * nothing is traced.
 *
 * What makes it work: a full-width bar between two blind concrete party walls,
 * the stair and the services against them, the living room at the garden end
 * and one small patio, open to the sky, bringing light into the middle of the
 * deep plan. Upstairs the bar cantilevers 2.40 m over the garden, carried by
 * its party walls as wall-beams, and stops short of the street, leaving the
 * ground floor's street band under a planted roof.
 *
 * Coordinates, as in src/config/plan.ts: metres, x across the lot from the
 * outer face of the west party wall, z along it from the outer face of the
 * street wall (the street is south, the garden north, as in the main house).
 * Opening offsets (`at`) run along their wall from its west or south end.
 */

const EXT = 0.3;
const PART = 0.15;
const GLASS = 0.1;

/** The lot's width between the outer faces of the party walls: 8.10 m clear between them. */
const WIDTH = 8.7;
const WEST = EXT;
const EAST = WIDTH - EXT;
/** The ground floor's garden face, where its glazing stands. */
const GARDEN = 15.6;
/** The upper floor's garden end, 2.40 m past the ground floor. */
const END = 18;
/** Where the upper floor starts: the planted roof lies on the ground floor, street side of it. */
const UPPER = 4;

/** The patio, open to the sky: its floor is planted earth, so it is a void in the ground slab too. */
const PATIO: Rect = { x: [2.4, 4.7], z: [6.95, 10.25] };
const STAIR: Rect = { x: [WEST, 1.3], z: [5.4, 10.16] };

const plan: SheetPlan = {
  // Floor to floor 3.20 m. Each slab is 0.25 m of post-tensioned concrete spanning 8.40 m between the party
  // walls' axes, under 0.10 m of build-up; 2.85 m clear on both floors. No columns: the party walls carry
  // everything, and upstairs they are wall-beams that carry the cantilever.
  heights: { slab: 0.35, structure: 0.25, ground: 3.55, upper: 3.2, door: 2.1 },
  column: 0.3,
  grid: {
    // The party walls.
    x: [
      { id: '1', at: 0.15 },
      { id: '2', at: 8.55 },
    ],
    // The street wall, the upper floor's street wall, the edge beams either side of the patio, and the garden face.
    z: [
      { id: 'A', at: 0.15 },
      { id: 'B', at: 4.15 },
      { id: 'C', at: 6.9 },
      { id: 'D', at: 10.3 },
      { id: 'E', at: 15.45 },
    ],
  },

  ground: {
    name: 'Planta baja',
    slab: { x: [0, WIDTH], z: [0, GARDEN] },
    walls: [
      // The party walls: load-bearing concrete, blind.
      { kind: 'concrete', x: [0, WEST], z: [0, GARDEN] },
      { kind: 'concrete', x: [EAST, WIDTH], z: [0, GARDEN] },
      // The street wall: the front door with a sidelight, the study's window, the bath's high window.
      {
        kind: 'concrete',
        x: [WEST, EAST],
        z: [0, EXT],
        openings: [
          { type: 'door', at: 0.1, width: 1.0, hinge: 'min', side: 1, head: 2.4 },
          { type: 'glass', at: 1.25, width: 0.6 },
          { type: 'window', at: 2.9, width: 2.0, sill: 0.9, head: 2.1 },
          { type: 'window', at: 6.3, width: 1.0, sill: 1.6, head: 2.1 },
        ],
      },
      // The street band: the entrance passage along the west party wall, the study, its bath and the laundry.
      {
        kind: 'partition',
        x: [2.3, 2.3 + PART],
        z: [EXT, 4.7],
        openings: [{ type: 'door', at: 3.4, width: 0.8, hinge: 'max', side: 1 }],
      },
      {
        kind: 'partition',
        x: [5.85, 5.85 + PART],
        z: [EXT, 4.7],
        openings: [{ type: 'door', at: 1.2, width: 0.7, hinge: 'min', side: 1 }],
      },
      { kind: 'partition', x: [6.0, EAST], z: [2.6, 2.6 + PART] },
      // The stack behind the laundry, in the corner of the party wall.
      { kind: 'partition', x: [8.0, EAST], z: [2.75, 3.15] },
      // Between the street band and the kitchen; the laundry opens off the kitchen.
      {
        kind: 'partition',
        x: [2.3, EAST],
        z: [4.7, 4.7 + PART],
        openings: [{ type: 'door', at: 4.0, width: 0.8, hinge: 'max', side: -1 }],
      },
      // The toilette, off the hall beside the stair, lit from the patio by a high window; the pantry behind it opens to the kitchen.
      {
        kind: 'partition',
        x: [2.3, 2.3 + PART],
        z: [4.85, 6.8],
        openings: [{ type: 'door', at: 0.15, width: 0.7, hinge: 'min', side: 1 }],
      },
      { kind: 'partition', x: [4.05, 4.05 + PART], z: [4.85, 6.8] },
      {
        kind: 'partition',
        x: [2.3, 4.8],
        z: [6.8, 6.8 + PART],
        openings: [{ type: 'window', at: 0.5, width: 0.9, sill: 1.6, head: 2.1 }],
      },
      // The patio, glazed on three sides: fixed towards the hall, sliding to the kitchen and to the living room.
      { kind: 'glazing', x: [2.3, 2.3 + GLASS], z: [6.95, 10.35], openings: [{ type: 'glass', at: 0, width: 3.4 }] },
      { kind: 'glazing', x: [4.7, 4.7 + GLASS], z: [6.95, 10.35], openings: [{ type: 'slider', at: 0, width: 3.4, leaves: 2 }] },
      { kind: 'glazing', x: [2.4, 4.7], z: [10.25, 10.35], openings: [{ type: 'slider', at: 0, width: 2.3, leaves: 2 }] },
      // The garden, glazed wall to wall in one run.
      { kind: 'glazing', x: [WEST, EAST], z: [GARDEN - GLASS, GARDEN], openings: [{ type: 'slider', at: 0, width: 8.1, leaves: 4 }] },
    ],
    columns: [],
    voids: [PATIO],
    // A straight flight along the west party wall, rising towards the garden, with a rail on its open side.
    stair: { ...STAIR, risers: 18, up: 'n' },
    rails: [{ x: [1.3, 1.35], z: [5.4, 10.16] }],
    rooms: [
      { name: 'Acceso', rect: { x: [WEST, 2.3], z: [EXT, 4.7] }, label: [1.3, 3.3] },
      { name: 'Estudio / Huésp.', abbr: 'Est. / Huésp.', rect: { x: [2.45, 5.85], z: [EXT, 4.7] }, label: [4.15, 1.65] },
      { name: 'Baño', rect: { x: [6.0, EAST], z: [EXT, 2.6] }, label: [7.4, 1.1] },
      { name: 'Lavadero', abbr: 'Lav.', rect: { x: [6.0, EAST], z: [2.75, 4.7] }, label: [7.2, 3.65] },
      { name: 'Toilette', abbr: 'Toil.', rect: { x: [2.45, 4.05], z: [4.85, 6.8] }, label: [3.45, 5.9] },
      { name: 'Patio', rect: PATIO, label: [3.55, 8.6] },
      { name: 'Cocina', rect: { x: [4.8, EAST], z: [4.85, 10.35] }, label: [6.25, 5.35] },
      { name: 'Estar', rect: { x: [WEST, 4.55], z: [10.35, GARDEN - GLASS] }, label: [2.4, 10.8], npt: true },
      { name: 'Comedor', rect: { x: [4.55, EAST], z: [10.35, GARDEN - GLASS] }, label: [6.45, 14.8] },
      { name: 'Galería', rect: { x: [0, WIDTH], z: [GARDEN, END] }, label: [3.2, 16.8], semicovered: true },
    ],
    fixtures: [
      // A closet in the passage, clear of the front door's leaf.
      { kind: 'wardrobe', rect: { x: [WEST, 0.9], z: [1.5, 2.9] }, facing: 'e' },
      // The study, or a guest room: a desk under the street window and a sofa bed.
      { kind: 'desk', rect: { x: [3.3, 5.1], z: [EXT, 1.0] }, facing: 's' },
      { kind: 'sofa', rect: { x: [4.95, 5.85], z: [2.4, 4.4] }, facing: 'w' },
      // Its bath: the basin under the high window, the wc and the shower on the wet wall.
      { kind: 'basin', rect: { x: [6.3, 7.1], z: [EXT, 0.8] }, facing: 'n' },
      { kind: 'wc', rect: { x: [6.8, 7.2], z: [1.95, 2.6] }, facing: 's' },
      { kind: 'shower', rect: { x: [7.4, EAST], z: [1.6, 2.6] }, facing: 's' },
      { kind: 'washer', rect: { x: [6.1, 6.75], z: [2.75, 3.35] }, facing: 'n' },
      { kind: 'sink', rect: { x: [6.9, 7.6], z: [2.75, 3.35] }, facing: 'n' },
      { kind: 'wc', rect: { x: [2.65, 3.05], z: [6.15, 6.8] }, facing: 's' },
      { kind: 'basin', rect: { x: [3.3, 4.0], z: [6.25, 6.8] }, facing: 's' },
      // The pantry's tall cupboards, then the kitchen: the island 1.05 m clear of them and of the worktop.
      { kind: 'tall', rect: { x: [4.2, 4.8], z: [4.85, 6.8] }, facing: 'e' },
      { kind: 'island', rect: { x: [5.85, 6.75], z: [6.0, 9.4] }, facing: 'e' },
      { kind: 'tall', rect: { x: [7.75, EAST], z: [4.85, 6.0] }, facing: 'w' },
      { kind: 'counter', rect: { x: [7.8, EAST], z: [6.1, 10.35] }, facing: 'w' },
      { kind: 'cooktop', rect: { x: [7.85, 8.35], z: [6.8, 7.6] }, facing: 'w' },
      { kind: 'sink', rect: { x: [7.84, 8.36], z: [8.6, 9.4] }, facing: 'w' },
      // The living room faces the garden; the dining table sits by the kitchen.
      { kind: 'sofa', rect: { x: [1.2, 3.6], z: [11.5, 12.4] }, facing: 'n' },
      { kind: 'table', rect: { x: [1.8, 3.0], z: [12.9, 13.7] }, facing: 'e' },
      { kind: 'armchair', rect: { x: [1.2, 2.0], z: [14.2, 15.0] }, facing: 's' },
      { kind: 'armchair', rect: { x: [2.8, 3.6], z: [14.2, 15.0] }, facing: 's' },
      { kind: 'table', rect: { x: [5.9, 6.9], z: [11.6, 14.0] }, facing: 'e', seats: 3 },
      { kind: 'table', rect: { x: [5.9, 8.1], z: [16.3, 17.3] }, facing: 'e', seats: 2 },
    ],
  },

  upper: {
    name: 'Planta alta',
    slab: { x: [0, WIDTH], z: [UPPER, END] },
    walls: [
      // The party walls run on to the garden end: wall-beams that carry the cantilever.
      { kind: 'concrete', x: [0, WEST], z: [UPPER, END] },
      { kind: 'concrete', x: [EAST, WIDTH], z: [UPPER, END] },
      // South, onto the planted roof, seen but not walked on; the wall is a beam from party wall to party wall.
      {
        kind: 'concrete',
        x: [WEST, EAST],
        z: [UPPER, UPPER + EXT],
        openings: [
          { type: 'window', at: 1.3, width: 2.8, sill: 0.9, head: 2.6 },
          { type: 'window', at: 5.0, width: 2.7, sill: 0.9, head: 2.6 },
        ],
      },
      // North, the garden: each bedroom glazed floor to ceiling.
      {
        kind: 'concrete',
        x: [WEST, EAST],
        z: [END - EXT, END],
        openings: [
          { type: 'slider', at: 0.4, width: 3.2, leaves: 2 },
          { type: 'slider', at: 4.5, width: 3.2, leaves: 2 },
        ],
      },
      // The suite's west wall, onto the family room and the patio's void; the window over the void is high, for privacy.
      {
        kind: 'partition',
        x: [4.7, 4.7 + PART],
        z: [UPPER + EXT, 10.35],
        openings: [
          { type: 'door', at: 0.3, width: 0.8, hinge: 'max', side: 1 },
          { type: 'window', at: 2.75, width: 0.7, sill: 1.6, head: 2.1 },
          { type: 'window', at: 4.1, width: 1.4, sill: 1.6, head: 2.1 },
        ],
      },
      // The void over the patio, glazed floor to ceiling towards the family room, the bridge and the hall.
      { kind: 'glazing', x: [2.4, 4.7], z: [6.85, 6.95], openings: [{ type: 'glass', at: 0, width: 2.3 }] },
      { kind: 'glazing', x: [2.3, 2.3 + GLASS], z: [6.85, 10.35], openings: [{ type: 'glass', at: 0, width: 3.5 }] },
      { kind: 'glazing', x: [2.4, 4.7], z: [10.25, 10.35], openings: [{ type: 'glass', at: 0, width: 2.3 }] },
      // The suite: its bath beside the bedroom, closed to the hall, and a dressing room past the bath.
      {
        kind: 'partition',
        x: [4.85, EAST],
        z: [7.85, 7.85 + PART],
        openings: [{ type: 'door', at: 0.15, width: 0.7, hinge: 'min', side: 1 }],
      },
      {
        kind: 'partition',
        x: [4.85, EAST],
        z: [10.2, 10.2 + PART],
        openings: [{ type: 'door', at: 1.0, width: 0.7, hinge: 'min', side: 1 }],
      },
      { kind: 'partition', x: [5.45, 5.45 + PART], z: [10.35, 12.25] },
      // The two bedrooms at the garden end, each with its bath between it and the hall.
      { kind: 'partition', x: [WEST, 3.25], z: [12.25, 12.4] },
      { kind: 'partition', x: [3.1, 3.1 + PART], z: [12.4, 14.2] },
      { kind: 'partition', x: [5.45, 5.45 + PART], z: [12.4, 14.2] },
      { kind: 'partition', x: [5.45, EAST], z: [12.25, 12.4] },
      // The stacks behind the baths' wcs, on the hall's and the dressing room's side.
      { kind: 'partition', x: [1.4, 1.8], z: [12.05, 12.25] },
      { kind: 'partition', x: [6.9, 7.3], z: [12.05, 12.25] },
      {
        kind: 'partition',
        x: [WEST, EAST],
        z: [14.2, 14.2 + PART],
        openings: [
          { type: 'door', at: 0.2, width: 0.7, hinge: 'min', side: -1 },
          { type: 'door', at: 3.05, width: 0.8, hinge: 'max', side: 1 },
          { type: 'door', at: 4.25, width: 0.8, hinge: 'min', side: 1 },
          { type: 'door', at: 7.2, width: 0.7, hinge: 'max', side: -1 },
        ],
      },
      { kind: 'partition', x: [4.275, 4.275 + PART], z: [14.35, END - EXT] },
    ],
    columns: [],
    // The stair well, and the patio's void: a bridge runs between them from the hall to the family room.
    voids: [STAIR, PATIO],
    rails: [
      { x: [1.3, 1.35], z: [STAIR.z[0], STAIR.z[1]] },
      { x: [WEST, 1.3], z: [STAIR.z[0] - 0.05, STAIR.z[0]] },
      // Balustrades across the bedrooms' garden sliders, on the cantilever.
      { x: [0.7, 3.9], z: [17.6, 17.65] },
      { x: [4.8, 8.0], z: [17.6, 17.65] },
    ],
    rooms: [
      { name: 'Estar íntimo', abbr: 'Est. ínt.', rect: { x: [1.3, 4.7], z: [UPPER + EXT, 6.85] }, label: [2.9, 4.6] },
      { name: 'Dormitorio principal', abbr: 'Dorm. ppal.', rect: { x: [4.85, EAST], z: [UPPER + EXT, 7.85] }, label: [6.6, 7.3] },
      { name: 'Baño principal', abbr: 'Baño ppal.', rect: { x: [4.85, EAST], z: [8.0, 10.2] }, label: [6.6, 9.0] },
      { name: 'Vestidor', abbr: 'Vest.', rect: { x: [5.6, EAST], z: [10.35, 12.25] }, label: [7.2, 11.4] },
      { name: 'Hall', rect: { x: [WEST, 5.45], z: [10.35, 12.25] }, label: [3.6, 11.1], npt: true },
      { name: 'Baño 1', rect: { x: [WEST, 3.1], z: [12.4, 14.2] }, label: [1.65, 13.37] },
      { name: 'Baño 2', rect: { x: [5.6, EAST], z: [12.4, 14.2] }, label: [7.05, 13.37] },
      { name: 'Dormitorio 1', abbr: 'Dorm. 1', rect: { x: [WEST, 4.275], z: [14.35, END - EXT] }, label: [1.9, 17.1] },
      { name: 'Dormitorio 2', abbr: 'Dorm. 2', rect: { x: [4.425, EAST], z: [14.35, END - EXT] }, label: [6.6, 17.1] },
    ],
    fixtures: [
      // The family room looks at the planted roof, its back to the patio's void.
      { kind: 'sofa', rect: { x: [2.5, 4.5], z: [5.95, 6.85] }, facing: 's' },
      { kind: 'table', rect: { x: [3.0, 4.0], z: [5.0, 5.6] }, facing: 'e' },
      // The suite: the bed's head on the party wall, then a bath with tub and shower.
      { kind: 'bed', rect: { x: [6.4, EAST], z: [5.3, 6.9] }, facing: 'w' },
      { kind: 'shower', rect: { x: [4.85, 5.85], z: [9.2, 10.2] }, facing: 's' },
      { kind: 'basin', rect: { x: [6.55, 7.35], z: [8.0, 8.55] }, facing: 'n' },
      { kind: 'wc', rect: { x: [7.7, 8.1], z: [8.0, 8.65] }, facing: 'n' },
      { kind: 'tub', rect: { x: [6.6, EAST], z: [9.5, 10.2] }, facing: 's' },
      // The bedrooms' baths: a walk-in shower across the far end, the wc and basin on the hall side.
      { kind: 'basin', rect: { x: [0.4, 1.1], z: [12.4, 12.95] }, facing: 'n' },
      { kind: 'wc', rect: { x: [1.4, 1.8], z: [12.4, 13.05] }, facing: 'n' },
      { kind: 'shower', rect: { x: [2.3, 3.1], z: [12.4, 14.2] }, facing: 'w' },
      { kind: 'shower', rect: { x: [5.6, 6.4], z: [12.4, 14.2] }, facing: 'e' },
      { kind: 'wc', rect: { x: [6.9, 7.3], z: [12.4, 13.05] }, facing: 'n' },
      { kind: 'basin', rect: { x: [7.6, 8.3], z: [12.4, 12.95] }, facing: 'n' },
      // The bedrooms: beds' heads on the party walls, wardrobes on the wall between them.
      { kind: 'bed', rect: { x: [WEST, 2.3], z: [15.3, 16.7] }, facing: 'e' },
      { kind: 'wardrobe', rect: { x: [3.675, 4.275], z: [15.4, 17.0] }, facing: 'w' },
      { kind: 'bed', rect: { x: [6.4, EAST], z: [15.3, 16.7] }, facing: 'w' },
      { kind: 'wardrobe', rect: { x: [4.425, 5.025], z: [15.4, 17.0] }, facing: 'e' },
    ],
  },

  // The covered terrace under the cantilever, between the party walls' projection.
  galeria: { x: [0, WIDTH], z: [GARDEN, END] },
};

export const project: Project = {
  id: 'casa-lote-angosto',
  name: 'Entre Medianeras',
  // PLACEHOLDER: demo values; the architect replaces the town and the status with the real ones.
  place: 'Rosario',
  status: 'En obra',
  // Covered area: 128 m² downstairs (less the patio) and 109 m² upstairs (less the stair well and the
  // patio's void), plus the 21 m² galería at half.
  area: 248,
  // The drafting sheet: the house plus room for its dimension strings, axis bubbles, title, north point and scale.
  site: { width: 15, depth: 23.5 },
  plan,
};
