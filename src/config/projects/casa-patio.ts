import { plan } from '../plan';
import type { Project } from '../projects';

/*
 * PLACEHOLDER, to be replaced (T19) with a house around an inner courtyard: a real plan
 * of its own, grounded on a published modern house (cited, not traced) and
 * audited by the architect reviewer. Until then the name, place, area and
 * status are invented and the plan is the main house's (src/config/plan.ts).
 */
export const project: Project = {
  id: 'casa-patio',
  name: 'Patio',
  place: 'Roldán',
  area: 210,
  status: 'Proyecto',
  site: { width: 30, depth: 20 },
  plan,
};
