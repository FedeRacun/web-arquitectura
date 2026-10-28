import { plan } from '../plan';
import type { Project } from '../projects';

/*
 * PLACEHOLDER, to be replaced (T19) with a house in an L around its garden: a real plan
 * of its own, grounded on a published modern house (cited, not traced) and
 * audited by the architect reviewer. Until then the name, place, area and
 * status are invented and the plan is the main house's (src/config/plan.ts).
 */
export const project: Project = {
  id: 'casa-en-l',
  name: 'en L',
  place: 'Funes',
  area: 240,
  status: 'Construida',
  site: { width: 26, depth: 18 },
  plan,
};
