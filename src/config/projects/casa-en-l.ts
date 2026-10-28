import type { SheetPlan } from '../../scripts/experience/building/plan';
import type { Project } from '../projects';

/*
 * A one-storey house in an L on a suburban lot: a social wing along the
 * street and a bedroom wing running away from it, with the garden inside the
 * L. The carport and the entry path sit at the hinge, under one roof.
 *
 * Reference: the typology, the two thin wings, the strips inside each one and
 * the glazed inner faces follow Casa en San Carlos by Marcelo Del Torto and
 * Torrado Arquitectos (San Carlos, Buenos Aires, 2016, 350 m²),
 * https://www.archdaily.com/es/792073/casa-en-san-carlos-marcelo-del-torto-plus-plus-torrado-arquitectos
 * This plan is our own simplification of that typology at about 250 m²,
 * not a copy; nothing is traced.
 *
 * Coordinates as the main house (src/config/plan.ts): x runs east from the
 * outer face of the bedroom wing's west wall; z runs north, away from the
 * street, from the outer face of the street wall. Opening offsets (`at`) are
 * measured along their wall from its west or south end.
 */

const EXT = 0.3;
const PART = 0.15;
/** The long concrete wall both wings share: the bedroom wing's south wall and the social wing's spine. */
const SPINE: [number, number] = [4.9, 5.2];
/** The bedroom wing's corridor: its west wall (concrete) and its glazed east face. */
const HALL_WEST = 6.8;
const HALL_EAST = 8.4;
/** The social wing's garden glass, the edge of its 1.10 m eave, and the end of the house. */
const GARDEN_GLASS = 10.0;
const GARDEN_EAVE = 11.2;
const EAST = 18.3;
const NORTH = 19.0;

const plan: SheetPlan = {
  // The main house's slab: 0.30 m of concrete, enough for the 6.5 m span in the bedroom wing and the
  // 8.1 m over the carport, under 0.10 m of build-up. 2.80 m clear.
  heights: { slab: 0.4, structure: 0.3, ground: 3.6, door: 2.1 },
  // Slender steel columns along the garden glass, in the eave.
  column: 0.15,
  grid: {
    x: [
      { id: '1', at: 0.15 },
      { id: '2', at: HALL_WEST + 0.15 },
      { id: '3', at: 8.85 },
      { id: '4', at: 13.35 },
      { id: '5', at: EAST - 0.15 },
    ],
    z: [
      { id: 'A', at: 0.15 },
      { id: 'B', at: SPINE[0] + 0.15 },
      { id: 'C', at: 11.05 },
      { id: 'D', at: NORTH - 0.15 },
    ],
  },

  ground: {
    name: 'Planta',
    slab: { x: [0, EAST], z: [0, NORTH] },
    // The bedroom wing, west, runs from the spine to the far end; the social wing lies along the street.
    footprint: [
      { x: [0, 9.0], z: [SPINE[0], NORTH] },
      { x: [HALL_EAST, EAST], z: [0, GARDEN_EAVE] },
    ],
    walls: [
      // The bedroom wing's outer face, onto the side garden: one window per bedroom, kept narrow
      // against the afternoon sun.
      {
        kind: 'concrete',
        x: [0, EXT],
        z: [SPINE[0], NORTH],
        openings: [
          { type: 'window', at: 1.75, width: 1.5, sill: 0.9, head: 2.4 },
          { type: 'window', at: 6.15, width: 1.5, sill: 0.9, head: 2.4 },
          { type: 'window', at: 10.5, width: 2.0, sill: 0.9, head: 2.4 },
        ],
      },
      // The far end: the main bedroom's slider to its own patio, the bath's high window, the corridor's glass.
      {
        kind: 'concrete',
        x: [EXT, 9.0],
        z: [NORTH - EXT, NORTH],
        openings: [
          { type: 'slider', at: 0.4, width: 3.0, leaves: 2 },
          { type: 'window', at: 4.7, width: 1.2, sill: 1.6, head: 2.1 },
          { type: 'glass', at: 6.95, width: 1.1 },
        ],
      },
      // The spine, one wall across both wings: behind the carport it holds the toilette's high window
      // and the front door, whose leaf folds back towards the dining room.
      {
        kind: 'concrete',
        x: [EXT, HALL_EAST],
        z: SPINE,
        openings: [
          { type: 'window', at: 4.95, width: 0.6, sill: 1.6, head: 2.1 },
          { type: 'door', at: 6.95, width: 1.0, hinge: 'max', side: 1, head: 2.4 },
        ],
      },
      // In the social wing it parts the street strip from the garden strip.
      {
        kind: 'concrete',
        x: [HALL_EAST, EAST - EXT],
        z: SPINE,
        openings: [
          { type: 'passage', at: 1.5, width: 2.4 },
          { type: 'door', at: 8.6, width: 0.8, hinge: 'max', side: -1 },
        ],
      },
      // The street face, mostly blind: the kitchen and the study look out, the laundry has a high window.
      {
        kind: 'concrete',
        x: [HALL_EAST, EAST],
        z: [0, EXT],
        openings: [
          { type: 'window', at: 0.8, width: 1.8, sill: 1.1, head: 2.1 },
          { type: 'window', at: 4.65, width: 1.0, sill: 1.6, head: 2.1 },
          { type: 'window', at: 6.9, width: 1.7, sill: 0.9, head: 2.1 },
        ],
      },
      // The kitchen's blind wall along the entry path.
      { kind: 'concrete', x: [HALL_EAST, HALL_EAST + EXT], z: [EXT, SPINE[0]] },
      // The east end, out to the eave's edge: fixed glass for the living room.
      {
        kind: 'concrete',
        x: [EAST - EXT, EAST],
        z: [EXT, GARDEN_EAVE],
        openings: [{ type: 'glass', at: 5.7, width: 3.6 }],
      },
      // The inner faces of the L, glazed onto the garden.
      {
        kind: 'glazing',
        x: [HALL_EAST, EAST - EXT],
        z: [GARDEN_GLASS, GARDEN_GLASS + 0.1],
        openings: [
          { type: 'slider', at: 0, width: 4.95, leaves: 3 },
          { type: 'slider', at: 4.95, width: 4.65, leaves: 3 },
        ],
      },
      // The corridor's eave cantilevers off its west wall, with no columns.
      {
        kind: 'glazing',
        x: [HALL_EAST, HALL_EAST + 0.1],
        z: [GARDEN_GLASS + 0.1, NORTH - EXT],
        openings: [
          { type: 'glass', at: 0, width: 4.4 },
          { type: 'slider', at: 4.4, width: 2.0, leaves: 2 },
          { type: 'glass', at: 6.4, width: 2.2 },
        ],
      },
      // The corridor's west wall carries the roof; each bedroom is entered through its own lobby.
      {
        kind: 'concrete',
        x: [HALL_WEST, HALL_WEST + EXT],
        z: [SPINE[1], NORTH - EXT],
        openings: [
          { type: 'door', at: 0.15, width: 0.7, hinge: 'min', side: -1 },
          { type: 'door', at: 3.45, width: 0.8, hinge: 'max', side: -1 },
          { type: 'door', at: 6.5, width: 0.8, hinge: 'min', side: -1 },
          { type: 'door', at: 10.05, width: 0.8, hinge: 'max', side: -1 },
        ],
      },
      // Bedrooms against the baths and lobbies: an open passage from each lobby.
      {
        kind: 'partition',
        x: [4.3, 4.3 + PART],
        z: [SPINE[1], NORTH - EXT],
        openings: [
          { type: 'passage', at: 3.4, width: 0.9 },
          { type: 'passage', at: 6.55, width: 1.0 },
          { type: 'passage', at: 9.95, width: 0.9 },
        ],
      },
      // Between the bedrooms.
      { kind: 'partition', x: [EXT, 4.3], z: [9.6, 9.6 + PART] },
      { kind: 'partition', x: [4.45, HALL_WEST], z: [9.6, 9.6 + PART] },
      { kind: 'partition', x: [EXT, 4.3], z: [13.9, 13.9 + PART] },
      { kind: 'partition', x: [4.45, HALL_WEST], z: [13.9, 13.9 + PART] },
      // The bath strip: toilette, then each bath behind its lobby. The toilette, Baño 1 and Baño 2 are
      // inside the house: each needs mechanical extraction to a duct through the roof.
      { kind: 'partition', x: [4.45, HALL_WEST], z: [6.55, 6.55 + PART] },
      {
        kind: 'partition',
        x: [4.45, HALL_WEST],
        z: [8.4, 8.4 + PART],
        openings: [{ type: 'door', at: 0.15, width: 0.7, hinge: 'min', side: -1 }],
      },
      {
        kind: 'partition',
        x: [4.45, HALL_WEST],
        z: [11.45, 11.45 + PART],
        openings: [{ type: 'door', at: 0.15, width: 0.7, hinge: 'min', side: -1 }],
      },
      {
        kind: 'partition',
        x: [4.45, HALL_WEST],
        z: [16.15, 16.15 + PART],
        openings: [{ type: 'door', at: 1.45, width: 0.7, hinge: 'max', side: 1 }],
      },
      // The street strip: kitchen, laundry, study.
      {
        kind: 'partition',
        x: [12.45, 12.45 + PART],
        z: [EXT, SPINE[0]],
        openings: [{ type: 'door', at: 3.6, width: 0.8, hinge: 'max', side: 1 }],
      },
      { kind: 'partition', x: [14.4, 14.4 + PART], z: [EXT, SPINE[0]] },
    ],
    columns: [
      [8.85, 11.05],
      [13.35, 11.05],
    ],
    rooms: [
      { name: 'Cochera', rect: { x: [EXT, HALL_WEST], z: [0, SPINE[0]] }, label: [3.5, 2.6], semicovered: true },
      { name: 'Acceso', abbr: 'Acc.', rect: { x: [HALL_WEST, HALL_EAST], z: [0, SPINE[0]] }, label: [7.7, 2.6], semicovered: true },
      { name: 'Hall', rect: { x: [HALL_WEST + EXT, HALL_EAST], z: [SPINE[1], 8.4] }, label: [7.75, 7.2] },
      { name: 'Circulación', abbr: 'Circ.', rect: { x: [HALL_WEST + EXT, HALL_EAST], z: [8.4, NORTH - EXT] }, label: [7.75, 13.0] },
      { name: 'Comedor', rect: { x: [HALL_EAST, 12.6], z: [SPINE[1], GARDEN_GLASS] }, label: [10.5, 6.1] },
      { name: 'Estar', rect: { x: [12.6, EAST - EXT], z: [SPINE[1], GARDEN_GLASS] }, label: [17.0, 7.4], npt: true },
      { name: 'Cocina', rect: { x: [HALL_EAST + EXT, 12.45], z: [EXT, SPINE[0]] }, label: [11.0, 3.9] },
      { name: 'Lavadero', abbr: 'Lav.', rect: { x: [12.6, 14.4], z: [EXT, SPINE[0]] }, label: [13.9, 2.6] },
      { name: 'Estudio', rect: { x: [14.55, EAST - EXT], z: [EXT, SPINE[0]] }, label: [16.5, 2.6] },
      { name: 'Dormitorio 1', abbr: 'Dorm. 1', rect: { x: [EXT, 4.3], z: [SPINE[1], 9.6] }, label: [2.2, 8.4] },
      { name: 'Dormitorio 2', abbr: 'Dorm. 2', rect: { x: [EXT, 4.3], z: [9.75, 13.9] }, label: [2.2, 12.6] },
      { name: 'Dormitorio principal', abbr: 'Dorm. ppal.', rect: { x: [EXT, 4.3], z: [14.05, NORTH - EXT] }, label: [2.2, 17.2] },
      { name: 'Toilette', abbr: 'Toil.', rect: { x: [4.45, HALL_WEST], z: [SPINE[1], 6.55] }, label: [5.6, 6.12] },
      { name: 'Baño 1', rect: { x: [4.45, HALL_WEST], z: [6.7, 8.4] }, label: [6.0, 8.0] },
      { name: 'Baño 2', rect: { x: [4.45, HALL_WEST], z: [9.75, 11.45] }, label: [6.0, 11.05] },
      { name: 'Vestidor', abbr: 'Vest.', rect: { x: [4.45, HALL_WEST], z: [14.05, 16.15] }, label: [5.62, 15.1] },
      // Lettered "Baño": "Baño ppal." is wider than the room left beside its two basins.
      { name: 'Baño principal', abbr: 'Baño', rect: { x: [4.45, HALL_WEST], z: [16.3, NORTH - EXT] }, label: [5.9, 17.5] },
    ],
    fixtures: [
      // Kitchen: sink under the street window, the cooktop past it, tall units on the blind wall, and an
      // island 0.90 m clear of the tall units and the laundry wall, 1.20 m off the run.
      { kind: 'counter', rect: { x: [HALL_EAST + EXT, 12.45], z: [EXT, 0.9] }, facing: 'n' },
      { kind: 'sink', rect: { x: [9.6, 10.4], z: [0.32, 0.88] }, facing: 'n' },
      { kind: 'cooktop', rect: { x: [11.35, 12.15], z: [0.35, 0.85] }, facing: 'n' },
      { kind: 'tall', rect: { x: [HALL_EAST + EXT, 9.3], z: [1.6, 3.4] }, facing: 'e' },
      { kind: 'island', rect: { x: [10.2, 11.55], z: [2.1, 3.0] }, facing: 'n' },
      // Laundry: no drying yard on the street side, so it relies on a dryer, stacked over the washer.
      { kind: 'washer', rect: { x: [12.6, 13.25], z: [EXT, 0.95] }, facing: 'n' },
      { kind: 'sink', rect: { x: [13.45, 14.25], z: [EXT, 0.85] }, facing: 'n' },
      // Study: the desk under the street window, a sofa against the laundry.
      { kind: 'desk', rect: { x: [15.3, 17.3], z: [EXT, 1.0] }, facing: 'n' },
      { kind: 'sofa', rect: { x: [14.55, 15.45], z: [2.4, 4.4] }, facing: 'e' },
      // Dining by the kitchen, living towards the east glass.
      { kind: 'table', rect: { x: [9.4, 11.6], z: [7.0, 8.0] }, facing: 'n', seats: 3 },
      { kind: 'sofa', rect: { x: [13.8, 16.2], z: [5.4, 6.3] }, facing: 'n' },
      { kind: 'table', rect: { x: [14.4, 15.6], z: [6.9, 7.6] }, facing: 'n' },
      { kind: 'armchair', rect: { x: [13.8, 14.6], z: [8.4, 9.2] }, facing: 's' },
      { kind: 'armchair', rect: { x: [15.4, 16.2], z: [8.4, 9.2] }, facing: 's' },
      // Bedrooms: each bed's head against the partition to the south.
      { kind: 'bed', rect: { x: [1.5, 2.9], z: [SPINE[1], 7.1] }, facing: 'n' },
      { kind: 'wardrobe', rect: { x: [3.7, 4.3], z: [SPINE[1], 7.6] }, facing: 'w' },
      { kind: 'bed', rect: { x: [1.5, 2.9], z: [9.75, 11.65] }, facing: 'n' },
      { kind: 'wardrobe', rect: { x: [4.45, HALL_WEST], z: [13.3, 13.9] }, facing: 's' },
      { kind: 'bed', rect: { x: [1.4, 3.0], z: [14.05, 16.05] }, facing: 'n' },
      { kind: 'wardrobe', rect: { x: [4.45, HALL_WEST], z: [14.05, 14.65] }, facing: 'n' },
      // Every wc keeps 0.40 m from its axis to the walls and fittings beside it. The toilette's backs
      // onto Baño 1's on the shared partition; its basin sits under the high window.
      { kind: 'wc', rect: { x: [4.65, 5.05], z: [5.9, 6.55] }, facing: 's' },
      { kind: 'basin', rect: { x: [5.25, 5.75], z: [SPINE[1], 5.6] }, facing: 'n' },
      // Baths 1 and 2: wc, basin and shower along the far wall, clear of the door.
      { kind: 'wc', rect: { x: [4.65, 5.05], z: [6.7, 7.35] }, facing: 'n' },
      { kind: 'basin', rect: { x: [5.25, 5.75], z: [6.7, 7.15] }, facing: 'n' },
      { kind: 'shower', rect: { x: [5.95, HALL_WEST], z: [6.7, 7.6] }, facing: 's' },
      { kind: 'wc', rect: { x: [4.65, 5.05], z: [9.75, 10.4] }, facing: 'n' },
      { kind: 'basin', rect: { x: [5.25, 5.75], z: [9.75, 10.2] }, facing: 'n' },
      { kind: 'shower', rect: { x: [5.95, HALL_WEST], z: [9.75, 10.65] }, facing: 's' },
      // Main bath: the tub and the wc side by side under the high window, two basins on the partition.
      { kind: 'tub', rect: { x: [4.45, 5.95], z: [17.95, NORTH - EXT] }, facing: 's' },
      { kind: 'wc', rect: { x: [6.2, 6.6], z: [18.05, NORTH - EXT] }, facing: 's' },
      { kind: 'basin', rect: { x: [4.45, 4.95], z: [16.4, 16.9] }, facing: 'e' },
      { kind: 'basin', rect: { x: [4.45, 4.95], z: [17.1, 17.6] }, facing: 'e' },
      // A desk at the corridor's end, under its north glass.
      { kind: 'desk', rect: { x: [HALL_WEST + EXT, HALL_EAST], z: [18.1, NORTH - EXT] }, facing: 'n' },
    ],
  },

  // The carport's west wall: the bedroom wing's outer face, run on to the street.
  blade: { x: [0, EXT], z: [-0.6, SPINE[0]], height: 3.6 },
  // One slab over the carport and the entry path, from that wall to the kitchen's.
  canopy: { x: [EXT, HALL_EAST], z: [-0.6, SPINE[0]] },
  // The carport and the path, paved under it.
  galeria: { x: [EXT, HALL_EAST], z: [0, SPINE[0]] },
};

export const project: Project = {
  id: 'casa-en-l',
  name: 'en L',
  // PLACEHOLDER demo values: the architect replaces the place and the status with the real ones.
  place: 'Funes',
  area: 254,
  status: 'Construida',
  // The plot: about 3 m to each side of the house and 5 m or more in front of it.
  site: { width: 26, depth: 32 },
  plan,
};
