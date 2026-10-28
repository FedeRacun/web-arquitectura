import type { Plan } from '../scripts/experience/building/plan';

/*
 * The house's floor plans, as an architect would set them out: walls,
 * openings, columns, the stair, rooms and fittings, in metres. The drawing in
 * scene 2 and every wall the building raises in scene 3 are cut from these
 * numbers, so the plan drawn is the house built.
 *
 * Coordinates: x runs east along the house from the outer face of the ground
 * floor's west wall; z runs north, towards the garden and the viewer, from
 * the outer face of its south wall. Opening offsets (`at`) are measured along
 * their wall from its west or south end; heights from the level's floor.
 *
 * Reference: the program, the room sizes, the single-loaded upper corridor
 * with the stair along it and the cantilevered suite follow Adolfo
 * Schlieper's Cantilevered House (Roldán, Argentina, 2021, 311 m²),
 * https://www.archdaily.com/1013738/cantilevered-house-adolfo-schlieper-arquitectos
 * The plan is our own, adapted to this composition; nothing is traced.
 */

const EXT = 0.3;
const PART = 0.15;

export const plan: Plan = {
  heights: { slab: 0.25, ground: 3.6, upper: 3.4, door: 2.1, parapet: 1.0 },
  column: 0.3,
  grid: {
    x: [
      { id: '1', at: 0.15 },
      { id: '2', at: 4.65 },
      { id: '3', at: 9.75 },
      { id: '4', at: 14.85 },
    ],
    z: [
      { id: 'A', at: 0.15 },
      { id: 'B', at: 8.25 },
    ],
  },

  ground: {
    name: 'Planta baja',
    slab: { x: [0, 15], z: [0, 10.2] },
    walls: [
      // South: the street side, closed, with the entrance.
      {
        kind: 'concrete',
        x: [0, 15],
        z: [0, EXT],
        openings: [
          { type: 'door', at: 1.7, width: 1.0, hinge: 'min', side: 1, head: 2.4 },
          { type: 'window', at: 10.54, width: 0.7, sill: 1.6, head: 2.1 },
          { type: 'window', at: 12.65, width: 1.2, sill: 1.1, head: 2.1 },
        ],
      },
      // West, shaded by the blade; east, onto the galería under the cantilever.
      { kind: 'concrete', x: [0, EXT], z: [EXT, 10.2] },
      {
        kind: 'concrete',
        x: [15 - EXT, 15],
        z: [EXT, 10.2],
        openings: [
          { type: 'door', at: 0.6, width: 0.8, hinge: 'min', side: -1 },
          { type: 'slider', at: 5.7, width: 1.8, leaves: 2 },
        ],
      },
      // North: the garden, glazed wall to wall behind the slab's 0.60 m eave.
      { kind: 'glazing', x: [EXT, 15 - EXT], z: [9.55, 9.65], openings: [{ type: 'slider', at: 0, width: 14.4, leaves: 6 }] },
      // The entrance hall's screen towards the living room.
      { kind: 'partition', x: [EXT, 3.3], z: [2.55, 2.55 + PART] },
      // Toilette and laundry along the south wall.
      {
        kind: 'partition',
        x: [9.99, 9.99 + PART],
        z: [EXT, 2.55],
        openings: [{ type: 'door', at: 1.4, width: 0.7, hinge: 'max', side: 1 }],
      },
      { kind: 'partition', x: [11.64, 11.64 + PART], z: [EXT, 2.55] },
      {
        kind: 'partition',
        x: [9.99, 15 - EXT],
        z: [2.55, 2.55 + PART],
        openings: [{ type: 'door', at: 3.8, width: 0.8, hinge: 'max', side: -1 }],
      },
    ],
    columns: [
      [4.65, 8.25],
      [9.75, 8.25],
    ],
    stair: { x: [4.95, 9.99], z: [EXT, 1.4], risers: 19, up: 'e' },
    rooms: [
      { name: 'Acceso', rect: { x: [EXT, 4.95], z: [EXT, 2.55] }, label: [3.5, 1.6] },
      { name: 'Estar', rect: { x: [EXT, 6], z: [2.7, 9.55] }, label: [3.0, 7.0], npt: true },
      { name: 'Comedor', rect: { x: [6, 9.99], z: [2.7, 9.55] }, label: [8.0, 7.0] },
      { name: 'Cocina', rect: { x: [9.99, 15 - EXT], z: [2.7, 9.55] }, label: [12.4, 7.0] },
      { name: 'Toilette', abbr: 'Toil.', rect: { x: [9.99 + PART, 11.64], z: [EXT, 2.55] }, label: [10.64, 1.25] },
      { name: 'Lavadero', abbr: 'Lav.', rect: { x: [11.64 + PART, 15 - EXT], z: [EXT, 2.55] }, label: [12.8, 1.45] },
      { name: 'Galería', rect: { x: [15, 21.6], z: [0, 8.4] }, label: [18.3, 6.4], semicovered: true },
    ],
    fixtures: [
      // A closet behind the front door's leaf.
      { kind: 'wardrobe', rect: { x: [EXT, 1.5], z: [EXT, 0.9] }, facing: 'n' },
      { kind: 'sofa', rect: { x: [0.8, 3.2], z: [2.75, 3.65] }, facing: 'n' },
      { kind: 'armchair', rect: { x: [0.8, 1.6], z: [5.4, 6.2] }, facing: 's' },
      { kind: 'armchair', rect: { x: [2.4, 3.2], z: [5.4, 6.2] }, facing: 's' },
      { kind: 'table', rect: { x: [1.4, 2.6], z: [4.25, 4.85] }, facing: 'n' },
      { kind: 'table', rect: { x: [6.8, 9.2], z: [5.0, 6.0] }, facing: 'n', seats: 4 },
      // Sink, 1.10 m of worktop, cooktop; the island 1.20 m clear of the tall units.
      { kind: 'counter', rect: { x: [10.14, 13.64], z: [2.7, 3.3] }, facing: 'n' },
      { kind: 'sink', rect: { x: [10.5, 11.3], z: [2.72, 3.28] }, facing: 'n' },
      { kind: 'cooktop', rect: { x: [12.4, 13.2], z: [2.75, 3.25] }, facing: 'n' },
      { kind: 'tall', rect: { x: [14.1, 14.7], z: [3.4, 5.2] }, facing: 'w' },
      { kind: 'island', rect: { x: [10.9, 12.9], z: [4.6, 5.6] }, facing: 'n' },
      { kind: 'wc', rect: { x: [10.6, 11.0], z: [EXT, 0.95] }, facing: 'n' },
      { kind: 'basin', rect: { x: [11.14, 11.64], z: [1.55, 2.1] }, facing: 'w' },
      // Washer and dryer stacked, clear of the service door's swing.
      { kind: 'washer', rect: { x: [11.85, 12.5], z: [EXT, 0.95] }, facing: 'n' },
      { kind: 'sink', rect: { x: [12.75, 13.55], z: [EXT, 0.85] }, facing: 'n' },
      { kind: 'table', rect: { x: [17.1, 19.5], z: [3.3, 4.3] }, facing: 'n', seats: 4 },
    ],
  },

  upper: {
    name: 'Planta alta',
    slab: { x: [4.5, 21.6], z: [0, 8.4] },
    walls: [
      {
        kind: 'concrete',
        x: [4.5, 21.6],
        z: [0, EXT],
        openings: [
          { type: 'window', at: 0.6, width: 4.7, sill: 0.9, head: 2.7 },
          { type: 'window', at: 7.5, width: 0.9, sill: 1.5, head: 2.1 },
          { type: 'window', at: 11.5, width: 1.2, sill: 1.5, head: 2.1 },
        ],
      },
      // North: the ribbon window, with a mullion wherever a partition meets it. It stops short of the
      // ground floor's east wall, where the cantilever hangs from this wall, and starts again past it.
      {
        kind: 'concrete',
        x: [4.5, 21.6],
        z: [8.1, 8.4],
        openings: [
          { type: 'window', at: 0.9, width: 9.3, sill: 1.0, head: 2.5, mullions: [3.525, 7.275] },
          { type: 'window', at: 10.8, width: 5.4, sill: 1.0, head: 2.5 },
        ],
      },
      // West: the door out to the terrace; east: the cantilever's end, glazed floor to ceiling.
      {
        kind: 'concrete',
        x: [4.5, 4.5 + EXT],
        z: [EXT, 8.1],
        openings: [{ type: 'door', at: 1.3, width: 0.9, hinge: 'min', side: 1 }],
      },
      { kind: 'concrete', x: [21.6 - EXT, 21.6], z: [EXT, 8.1], openings: [{ type: 'glass', at: 2.4, width: 5.4 }] },
      // The south band: bath, linen, the suite's bath over the ground floor's east wall (where its
      // stack comes down) and the dressing room at the end of the cantilever.
      {
        kind: 'partition',
        x: [11.19, 21.6 - EXT],
        z: [2.55, 2.55 + PART],
        openings: [
          { type: 'door', at: 0.25, width: 0.7, hinge: 'min', side: -1 },
          { type: 'door', at: 2.71, width: 0.7, hinge: 'min', side: -1 },
          { type: 'door', at: 5.2, width: 0.8, hinge: 'min', side: -1 },
          { type: 'door', at: 7.41, width: 0.8, hinge: 'min', side: -1 },
        ],
      },
      { kind: 'partition', x: [11.19, 11.19 + PART], z: [EXT, 2.55] },
      { kind: 'partition', x: [13.59, 13.59 + PART], z: [EXT, 2.55] },
      { kind: 'partition', x: [15, 15 + PART], z: [EXT, 2.55] },
      { kind: 'partition', x: [18.15, 18.15 + PART], z: [EXT, 2.55] },
      // The corridor's north side and the bedrooms off it.
      {
        kind: 'partition',
        x: [4.5 + EXT, 15],
        z: [3.9, 3.9 + PART],
        openings: [
          { type: 'door', at: 3.1, width: 0.8, hinge: 'max', side: 1 },
          { type: 'door', at: 6.8, width: 0.8, hinge: 'max', side: 1 },
          { type: 'door', at: 9.1, width: 0.8, hinge: 'max', side: 1 },
        ],
      },
      { kind: 'partition', x: [8.85, 8.85 + PART], z: [3.9 + PART, 8.1] },
      { kind: 'partition', x: [12.6, 12.6 + PART], z: [3.9 + PART, 8.1] },
      {
        kind: 'partition',
        x: [15, 15 + PART],
        z: [2.55 + PART, 8.1],
        openings: [{ type: 'door', at: 0.2, width: 0.85, hinge: 'min', side: 1 }],
      },
    ],
    columns: [],
    voids: [{ x: [4.5 + EXT, 9.99], z: [EXT, 1.4] }],
    rails: [{ x: [4.5 + EXT, 9.99], z: [1.4, 1.45] }],
    rooms: [
      { name: 'Hall', rect: { x: [4.5 + EXT, 11.19], z: [1.4, 3.9] }, label: [7.4, 2.45], npt: true },
      { name: 'Dormitorio 1', abbr: 'Dorm. 1', rect: { x: [4.5 + EXT, 8.85], z: [4.05, 8.1] }, label: [6.8, 5.1] },
      { name: 'Dormitorio 2', abbr: 'Dorm. 2', rect: { x: [9.0, 12.6], z: [4.05, 8.1] }, label: [10.6, 5.1] },
      { name: 'Estudio', rect: { x: [12.75, 15], z: [4.05, 8.1] }, label: [13.9, 5.6] },
      { name: 'Dormitorio principal', abbr: 'Dorm. ppal.', rect: { x: [15.15, 21.6 - EXT], z: [2.7, 8.1] }, label: [18.2, 4.0] },
      { name: 'Baño 1', rect: { x: [11.34, 13.59], z: [EXT, 2.55] }, label: [12.75, 1.3] },
      { name: 'Blancos', abbr: 'Bl.', rect: { x: [13.74, 15], z: [EXT, 2.55] }, label: [14.37, 1.35] },
      { name: 'Baño principal', abbr: 'Baño ppal.', rect: { x: [15.15, 18.15], z: [EXT, 2.55] }, label: [17.03, 1.35] },
      { name: 'Vestidor', rect: { x: [18.3, 21.6 - EXT], z: [EXT, 2.55] }, label: [19.6, 1.55] },
    ],
    fixtures: [
      // The beds' heads against the partitions, not under the ribbon window's sill.
      { kind: 'wardrobe', rect: { x: [4.8, 7.75], z: [4.05, 4.65] }, facing: 'n' },
      { kind: 'bed', rect: { x: [6.75, 8.85], z: [5.6, 7.2] }, facing: 'w' },
      { kind: 'wardrobe', rect: { x: [9.0, 11.45], z: [4.05, 4.65] }, facing: 'n' },
      { kind: 'bed', rect: { x: [10.5, 12.6], z: [5.6, 7.2] }, facing: 'w' },
      { kind: 'desk', rect: { x: [12.75, 15], z: [7.4, 8.1] }, facing: 'n' },
      { kind: 'bed', rect: { x: [15.15, 17.25], z: [4.8, 6.6] }, facing: 'e' },
      { kind: 'wardrobe', rect: { x: [13.74, 15], z: [EXT, 0.9] }, facing: 'n' },
      // Baño 1: the door clear of the shower, 0.60 m in front of the wc.
      { kind: 'wc', rect: { x: [12.95, 13.35], z: [EXT, 0.95] }, facing: 'n' },
      { kind: 'basin', rect: { x: [11.34, 11.9], z: [0.6, 1.5] }, facing: 'e' },
      { kind: 'shower', rect: { x: [12.49, 13.59], z: [1.55, 2.55] }, facing: 's' },
      // The suite's bath: tub on the wet wall, basin under the high window, wc beside it, out of the door's swing.
      { kind: 'tub', rect: { x: [15.15, 15.9], z: [EXT, 2.0] }, facing: 'e' },
      { kind: 'basin', rect: { x: [16.0, 17.0], z: [EXT, 0.85] }, facing: 'n' },
      { kind: 'wc', rect: { x: [17.3, 17.7], z: [EXT, 0.95] }, facing: 'n' },
      { kind: 'wardrobe', rect: { x: [18.3, 21.3], z: [EXT, 0.9] }, facing: 'n' },
      { kind: 'wardrobe', rect: { x: [20.7, 21.3], z: [0.9, 2.55] }, facing: 'w' },
    ],
  },

  blade: { x: [-1.65, -1.2], z: [-1.5, 11.7], height: 8.6 },
  galeria: { x: [15, 21.6], z: [0, 8.4] },
  // The terrace sits a step below the upper floor, so the door's threshold can be sealed. Only its west
  // part is walked on; the strip past the bedroom windows is gravel, behind a glass rail.
  terrace: {
    drop: 0.15,
    decks: [{ x: [EXT, 4.5], z: [EXT, 9.9] }],
    gravel: [{ x: [4.5, 15 - EXT], z: [8.4, 9.9] }],
    rails: [{ x: [4.5, 4.55], z: [8.4, 9.9] }],
    parapets: [
      { x: [0, 15], z: [9.9, 10.2] },
      { x: [0, EXT], z: [0, 9.9] },
      { x: [EXT, 4.5], z: [0, EXT] },
      { x: [15 - EXT, 15], z: [8.4, 9.9] },
    ],
  },
};
