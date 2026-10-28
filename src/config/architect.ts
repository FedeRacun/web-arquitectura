import { plan } from './plan';
import { projects } from './projects';

/*
 * Everything that changes from one architect to the next. The building is
 * generated from these numbers, so a new client means a new plan, new
 * material tones, an accent and a WhatsApp number; the code stays as is.
 * Lengths are metres; the scene draws one world unit per metre.
 */

export const architect = {
  /** Cursor, the closing button and one word per scene. */
  accent: '#B8743A',
  whatsapp: {
    // PLACEHOLDER: generic demo number. Replace with the architect's number in international format.
    number: '+54 9 11 0000-0000',
    message: 'Hola, quiero construir una casa y me gustaría contarles mi proyecto.',
  },
  building: {
    /** The empty plot drawn in scene 1 and seen from above in scene 8. */
    site: { width: 26, depth: 18 },
    /** The floor plans the house is drawn and raised from (src/config/plan.ts). */
    plan,
  },
  /** The studio's other houses, drafted beside the model in scene 7 (src/config/projects.ts). */
  projects,
  materials: {
    concrete: '#a5a29e',
    wood: '#8b5a34',
    glass: '#2a3436',
    /** Warm light behind the glass in scene 5. */
    interior: '#f2bd7c',
    /** The balsa of the model in scene 7. */
    balsa: '#d9c7a6',
  },
} as const;

export type Architect = typeof architect;
