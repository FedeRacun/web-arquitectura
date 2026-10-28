import type { Project } from '../projects';

/*
 * A one-storey house closed around a patio: the rooms make a ring, so every
 * one of them takes its light from the patio, and the bedrooms keep a blind
 * wall to it. Same terms as the main house (src/config/plan.ts): metres, x
 * east from the outer face of the west wall, z north from the street, which
 * is south; the garden is north.
 *
 * Reference: the typology, the bands (carport, patio, social strip, covered
 * terrace), the social strip's order with the free-standing core, and the
 * bedroom corridor along a blind wall follow Patio con Casa by Lescano-Puente
 * arqs (City Bell, La Plata, 2021, 180 m²),
 * https://www.archdaily.com/969663/patio-with-a-house-lescano-puente-arqs
 * The plan is our own simplification of that typology, not a copy; nothing
 * is traced. It enters along a glazed gallery beside the patio, into the
 * kitchen end of the social strip, and keeps the wet rooms together in the
 * bedroom wing.
 */

const EXT = 0.3;
const PART = 0.15;
/** Aluminium frames with double glazing, as deep as the slender columns that stand in their line. */
const GLASS = 0.15;

export const project: Project = {
  id: 'casa-patio',
  name: 'Patio',
  // PLACEHOLDER: demo values; the architect replaces the town and the status with the real ones.
  place: 'Roldán',
  status: 'Proyecto',
  // Enclosed 200 m², plus the carport and the galería at half (59 + 52 m²).
  area: 256,
  // The drafting sheet, not the lot: the house, its dimension strings and axis bubbles, the title and the north point.
  site: { width: 22.6, depth: 28.4 },
  plan: {
    // A flat 0.25 m roof slab under 0.10 m of build-up, 2.80 m clear throughout: the reference has 2.80 m to its
    // slab but 2.55 m under its beams, which the format has no way to draw, so the beams are left out.
    heights: { slab: 0.35, structure: 0.25, ground: 3.5, door: 2.1 },
    // Slender steel columns: the roof rests on them and on the load-bearing walls.
    column: 0.15,
    grid: {
      x: [
        { id: '1', at: 0.15 },
        { id: '2', at: 2.725 },
        { id: '3', at: 7.5 },
        { id: '4', at: 12.25 },
        { id: '5', at: 17.25 },
      ],
      z: [
        { id: 'A', at: 0.15 },
        { id: 'B', at: 5.15 },
        { id: 'C', at: 9.45 },
        { id: 'D', at: 13.775 },
        { id: 'E', at: 19.325 },
        { id: 'F', at: 22.325 },
      ],
    },

    ground: {
      name: 'Planta baja',
      slab: { x: [0, 17.4], z: [0, 22.4] },
      // The ring around the patio (x 2.80–12.10, z 5.30–13.70), which is left open: the social strip and its
      // galería on the garden side, the entrance gallery west, the bedroom wing east, and the carport on the
      // street side behind the patio's wall.
      footprint: [
        { x: [0, 17.4], z: [13.7, 22.4] },
        { x: [0, 2.8], z: [5.0, 13.7] },
        { x: [0, 12.1], z: [0, 5.3] },
        { x: [12.1, 17.4], z: [0, 13.7] },
      ],
      walls: [
        // West: the blind boundary wall, from the street to the galería; it closes the carport's side too.
        { kind: 'concrete', x: [0, EXT], z: [0, 19.4] },
        // The patio's wall to the carport, blind but for the front door into the gallery.
        {
          kind: 'concrete',
          x: [EXT, 12.1],
          z: [5.0, 5.0 + EXT],
          openings: [{ type: 'door', at: 0.6, width: 1.0, hinge: 'min', side: 1, head: 2.4 }],
        },
        // The bedroom wing's blind wall to the patio and the carport; the corridor behind it takes a skylight.
        { kind: 'concrete', x: [12.1, 12.1 + EXT], z: [0, 13.85] },
        // The wing's street front, with a high window for the second bedroom.
        {
          kind: 'concrete',
          x: [12.1 + EXT, 17.4],
          z: [0, EXT],
          openings: [{ type: 'window', at: 1.6, width: 2.0, sill: 1.6, head: 2.4 }],
        },
        // East: the rooms of the wing open to the side garden, and the laundry to the yard.
        {
          kind: 'concrete',
          x: [17.4 - EXT, 17.4],
          z: [EXT, 19.4],
          openings: [
            { type: 'window', at: 0.7, width: 2.0, sill: 0.9, head: 2.4 },
            { type: 'door', at: 3.75, width: 0.8, hinge: 'min', side: -1 },
            { type: 'window', at: 5.9, width: 0.8, sill: 1.6, head: 2.1 },
            { type: 'window', at: 7.6, width: 0.8, sill: 1.6, head: 2.1 },
            { type: 'slider', at: 10.1, width: 2.2, leaves: 2 },
            { type: 'window', at: 15.1, width: 2.0, sill: 0.9, head: 2.4 },
          ],
        },

        // The gallery's glass to the patio, either side of the column on axis 2: fixed by the front door, then sliding.
        { kind: 'glazing', x: [2.8 - GLASS, 2.8], z: [5.0 + EXT, 9.375], openings: [{ type: 'glass', at: 0, width: 4.075 }] },
        { kind: 'glazing', x: [2.8 - GLASS, 2.8], z: [9.525, 13.7], openings: [{ type: 'slider', at: 0, width: 4.175, leaves: 2 }] },
        // The social strip, glazed on both long sides between the columns: to the patio and to the galería.
        { kind: 'glazing', x: [2.8, 7.425], z: [13.7, 13.7 + GLASS], openings: [{ type: 'slider', at: 0, width: 4.625, leaves: 2 }] },
        { kind: 'glazing', x: [7.575, 12.1], z: [13.7, 13.7 + GLASS], openings: [{ type: 'slider', at: 0, width: 4.525, leaves: 2 }] },
        { kind: 'glazing', x: [EXT, 2.65], z: [19.4 - GLASS, 19.4], openings: [{ type: 'slider', at: 0, width: 2.35, leaves: 2 }] },
        { kind: 'glazing', x: [2.8, 7.425], z: [19.4 - GLASS, 19.4], openings: [{ type: 'slider', at: 0, width: 4.625, leaves: 2 }] },
        { kind: 'glazing', x: [7.575, 12.175], z: [19.4 - GLASS, 19.4], openings: [{ type: 'slider', at: 0, width: 4.6, leaves: 2 }] },
        {
          kind: 'glazing',
          x: [12.325, 17.4 - EXT],
          z: [19.4 - GLASS, 19.4],
          openings: [
            { type: 'glass', at: 0, width: 1.775 },
            { type: 'slider', at: 1.775, width: 3.0, leaves: 2 },
          ],
        },

        // The free-standing core, 1.20 m clear of the patio glass and 1.00 m of the galería's: the toilette opens
        // towards the bedroom corridor, the storeroom out towards the galería.
        {
          kind: 'partition',
          x: [11.8, 14.0],
          z: [15.05, 15.05 + PART],
          openings: [{ type: 'door', at: 0.35, width: 0.7, hinge: 'min', side: 1 }],
        },
        {
          kind: 'partition',
          x: [11.8, 14.0],
          z: [18.1, 18.1 + PART],
          openings: [{ type: 'door', at: 0.4, width: 0.7, hinge: 'min', side: 1 }],
        },
        { kind: 'partition', x: [11.8, 11.8 + PART], z: [15.2, 18.1] },
        { kind: 'partition', x: [14.0 - PART, 14.0], z: [15.2, 18.1] },
        { kind: 'partition', x: [12.2, 13.85], z: [16.75, 16.75 + PART] },
        // The vent shaft both rooms share, up through the roof, astride the wall between them.
        { kind: 'partition', x: [11.95, 12.2], z: [16.6, 17.05] },

        // The bedroom wing: the corridor's side, with the doors off it.
        {
          kind: 'partition',
          x: [13.4, 13.4 + PART],
          z: [3.85, 13.7],
          openings: [
            { type: 'door', at: 0.2, width: 0.8, hinge: 'min', side: 1 },
            { type: 'door', at: 2.05, width: 0.7, hinge: 'min', side: 1 },
            { type: 'door', at: 8.75, width: 0.8, hinge: 'max', side: 1 },
          ],
        },
        // Across the wing, from the street: bedroom 2, laundry, bath, the suite's bath (back to back on the
        // wet wall), the main bedroom and the study.
        {
          kind: 'partition',
          x: [12.1 + EXT, 17.4 - EXT],
          z: [3.7, 3.7 + PART],
          openings: [{ type: 'door', at: 0.1, width: 0.8, hinge: 'min', side: -1 }],
        },
        { kind: 'partition', x: [13.55, 17.4 - EXT], z: [5.5, 5.5 + PART] },
        { kind: 'partition', x: [13.55, 17.4 - EXT], z: [7.3, 7.3 + PART] },
        {
          kind: 'partition',
          x: [13.55, 17.4 - EXT],
          z: [9.1, 9.1 + PART],
          openings: [{ type: 'door', at: 0.2, width: 0.7, hinge: 'min', side: -1 }],
        },
        { kind: 'partition', x: [13.4, 17.4 - EXT], z: [13.7, 13.7 + PART] },
      ],
      // In the gallery's and the social strip's glass lines, along the galería's edge, and in the carport's street front.
      columns: [
        [2.725, 9.45],
        [2.725, 13.775],
        [7.5, 13.775],
        [2.725, 19.325],
        [7.5, 19.325],
        [12.25, 19.325],
        [0.15, 22.325],
        [2.725, 22.325],
        [7.5, 22.325],
        [12.25, 22.325],
        [17.25, 22.325],
        [2.725, 0.15],
        [7.5, 0.15],
      ],
      rooms: [
        { name: 'Acceso', rect: { x: [EXT, 2.65], z: [5.3, 13.85] }, label: [1.45, 11.0] },
        { name: 'Cocina', rect: { x: [EXT, 4.0], z: [13.85, 19.25] }, label: [1.7, 15.0] },
        { name: 'Comedor', rect: { x: [4.0, 7.5], z: [13.85, 19.25] }, label: [5.75, 15.0] },
        { name: 'Estar', rect: { x: [7.5, 11.8], z: [13.85, 19.25] }, label: [9.65, 15.0], npt: true },
        { name: 'Toilette', abbr: 'Toil.', rect: { x: [11.95, 13.85], z: [15.2, 16.75] }, label: [12.65, 16.35] },
        { name: 'Depósito', abbr: 'Dep.', rect: { x: [11.95, 13.85], z: [16.9, 18.1] }, label: [12.75, 17.55] },
        { name: 'Estudio', rect: { x: [14.0, 17.4 - EXT], z: [13.85, 19.25] }, label: [15.3, 15.0] },
        { name: 'Circulación', abbr: 'Circ.', rect: { x: [12.4, 13.4], z: [3.85, 13.85] }, label: [12.9, 9.0] },
        { name: 'Dormitorio principal', abbr: 'Dorm. ppal.', rect: { x: [13.55, 17.4 - EXT], z: [9.25, 13.7] }, label: [15.0, 10.9] },
        { name: 'Baño principal', abbr: 'Baño ppal.', rect: { x: [13.55, 17.4 - EXT], z: [7.45, 9.1] }, label: [14.9, 8.44] },
        { name: 'Baño', rect: { x: [13.55, 17.4 - EXT], z: [5.65, 7.3] }, label: [14.9, 6.2] },
        { name: 'Lavadero', rect: { x: [13.55, 17.4 - EXT], z: [3.85, 5.5] }, label: [15.32, 4.45] },
        { name: 'Dormitorio 2', abbr: 'Dorm. 2', rect: { x: [12.4, 17.4 - EXT], z: [EXT, 3.7] }, label: [15.72, 2.3] },
        // Under the roof slab, open to the street and to the garden.
        { name: 'Cochera', rect: { x: [EXT, 12.1], z: [0, 5.0] }, label: [6.2, 2.4], semicovered: true },
        { name: 'Galería', rect: { x: [0, 17.4], z: [19.4, 22.4] }, label: [13.5, 21.0], semicovered: true },
      ],
      fixtures: [
        // A coat closet by the front door, clear of its leaf.
        { kind: 'wardrobe', rect: { x: [EXT, 0.9], z: [6.5, 7.7] }, facing: 'e' },
        // The kitchen where the gallery arrives, against the blind west wall, the island 1.10 m clear of it.
        { kind: 'counter', rect: { x: [EXT, 0.9], z: [14.6, 17.4] }, facing: 'e' },
        { kind: 'sink', rect: { x: [0.32, 0.88], z: [14.9, 15.7] }, facing: 'e' },
        { kind: 'cooktop', rect: { x: [0.35, 0.85], z: [16.4, 17.2] }, facing: 'e' },
        { kind: 'tall', rect: { x: [EXT, 0.9], z: [17.4, 18.4] }, facing: 'e' },
        { kind: 'island', rect: { x: [2.0, 2.9], z: [15.4, 17.6] }, facing: 'w' },
        // Dining for eight.
        { kind: 'table', rect: { x: [4.55, 6.95], z: [16.0, 17.0] }, facing: 'n', seats: 4 },
        // The living gathered on the core: the sofa's back to its west face, looking along the strip, glass on both sides.
        { kind: 'sofa', rect: { x: [10.8, 11.7], z: [15.45, 17.85] }, facing: 'w' },
        { kind: 'table', rect: { x: [9.7, 10.4], z: [16.05, 17.25] }, facing: 'n' },
        { kind: 'armchair', rect: { x: [8.5, 9.3], z: [15.65, 16.45] }, facing: 'e' },
        { kind: 'armchair', rect: { x: [8.5, 9.3], z: [16.85, 17.65] }, facing: 'e' },
        // Toilette and storeroom inside the core: the wc's axis 0.40 m off the wall and the basin.
        { kind: 'wc', rect: { x: [13.2, 13.85], z: [15.4, 15.8] }, facing: 'w' },
        { kind: 'basin', rect: { x: [13.35, 13.85], z: [16.05, 16.65] }, facing: 'w' },
        { kind: 'wardrobe', rect: { x: [13.35, 13.85], z: [16.9, 18.1] }, facing: 'w' },
        // The study at the wing's end of the strip: a desk under the east window.
        { kind: 'desk', rect: { x: [16.4, 17.1], z: [15.4, 17.4] }, facing: 'e' },
        { kind: 'armchair', rect: { x: [14.7, 15.5], z: [17.6, 18.4] }, facing: 'e' },
        // Main bedroom: the bed's head on the study's wall, clear of the door; the wardrobe on the bath's wall.
        { kind: 'bed', rect: { x: [14.6, 16.2], z: [11.7, 13.7] }, facing: 's' },
        { kind: 'wardrobe', rect: { x: [14.6, 17.1], z: [9.25, 9.85] }, facing: 'n' },
        // The suite's bath: fittings on the wet wall, the shower under the high window.
        { kind: 'basin', rect: { x: [14.3, 15.1], z: [7.45, 7.95] }, facing: 'n' },
        { kind: 'wc', rect: { x: [15.45, 15.85], z: [7.45, 8.1] }, facing: 'n' },
        { kind: 'shower', rect: { x: [16.15, 17.1], z: [7.45, 9.1] }, facing: 'w' },
        // The other bath, back to back with it.
        { kind: 'wc', rect: { x: [14.45, 14.85], z: [6.65, 7.3] }, facing: 's' },
        { kind: 'basin', rect: { x: [15.45, 16.1], z: [6.8, 7.3] }, facing: 's' },
        { kind: 'shower', rect: { x: [16.15, 17.1], z: [5.65, 7.3] }, facing: 'w' },
        // Laundry on the same wet wall, clear of both doors' swings: the corridor's and the yard's.
        { kind: 'washer', rect: { x: [14.45, 15.1], z: [4.85, 5.5] }, facing: 's' },
        { kind: 'counter', rect: { x: [15.1, 17.1], z: [4.9, 5.5] }, facing: 's' },
        { kind: 'sink', rect: { x: [15.6, 16.4], z: [4.92, 5.48] }, facing: 's' },
        // Bedroom 2: the bed's head on the blind wall, the wardrobe clear of the door.
        { kind: 'bed', rect: { x: [12.4, 14.4], z: [0.9, 2.5] }, facing: 'e' },
        { kind: 'wardrobe', rect: { x: [13.6, 16.0], z: [3.1, 3.7] }, facing: 's' },
        // The galería: a table for eight off the kitchen, and two chairs off the living.
        { kind: 'table', rect: { x: [1.6, 4.0], z: [20.45, 21.35] }, facing: 'n', seats: 4 },
        { kind: 'armchair', rect: { x: [8.6, 9.4], z: [20.5, 21.3] }, facing: 'e' },
        { kind: 'armchair', rect: { x: [10.0, 10.8], z: [20.5, 21.3] }, facing: 'w' },
      ],
    },
  },
};
