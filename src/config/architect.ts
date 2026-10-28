/*
 * Everything that changes from one architect to the next. The building is
 * generated from these numbers, so a new client means a new proportion set,
 * new material tones, an accent and a WhatsApp number; the code stays as is.
 * Lengths are metres; the scene draws one world unit per metre.
 */

export const architect = {
  /** Cursor, the closing button and one word per scene. */
  accent: '#B8743A',
  whatsapp: {
    // PLACEHOLDER: generic demo number. Replace with the architect's number in international format.
    number: '+54 9 11 0000-0000',
    message: 'Hola, quiero conversar sobre mi próxima obra.',
  },
  building: {
    /** The empty plot drawn in scene 1 and seen from above in scene 8. */
    site: { width: 26, depth: 18 },
    /** Ground floor: a glazed box set back under the upper bar. */
    base: { width: 15, depth: 9.5, height: 3.6 },
    /** Upper bar, shifted along x so it cantilevers past the base. */
    upper: { width: 17, depth: 7.5, height: 3.4, shift: 4.5 },
    /** The concrete blade wall that crosses both floors on the left. */
    blade: { height: 8.6, thickness: 0.45 },
  },
  materials: {
    concrete: '#a39d93',
    wood: '#8b5a34',
    glass: '#2a3436',
    /** Warm light behind the glass in scene 5. */
    interior: '#f2bd7c',
    /** The balsa of the model in scene 7. */
    balsa: '#d9c7a6',
  },
} as const;

export type Architect = typeof architect;
