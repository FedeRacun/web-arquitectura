import { plan } from '../plan';
import type { Project } from '../projects';

/*
 * PLACEHOLDER, to be replaced (T19) with a house on a narrow lot, between party walls: a real plan
 * of its own, grounded on a published modern house (cited, not traced) and
 * audited by the architect reviewer. Until then the name, place, area and
 * status are invented and the plan is the main house's (src/config/plan.ts).
 */
export const project: Project = {
  id: 'casa-lote-angosto',
  name: 'Angosta',
  place: 'Rosario',
  area: 165,
  status: 'En obra',
  site: { width: 28, depth: 19 },
  plan,
};
