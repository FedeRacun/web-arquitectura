import type { SheetPlan } from '../scripts/experience/building/plan';
import { project as casaEnL } from './projects/casa-en-l';
import { project as casaLoteAngosto } from './projects/casa-lote-angosto';
import { project as casaPatio } from './projects/casa-patio';

/*
 * The studio's other houses, drafted in a row on the table beside the model
 * when the visitor asks for them in scene 7 ("Ver otros proyectos"). Each is
 * a plot and the floor plans of the house on it, in the same terms as the
 * main house (src/config/plan.ts), so the same drawing letters them all.
 */

export interface Project {
  /** Stable id: the file under src/config/projects/. */
  id: string;
  /** Without "Casa": the label reads "Casa {name}". */
  name: string;
  /** Town or city. */
  place: string;
  /** Built area, m². */
  area: number;
  status: 'Construida' | 'En obra' | 'Proyecto';
  /** The plot the plan is drafted on, in metres; the house is centred on it. */
  site: { width: number; depth: number };
  /** Floor plans in the main house's terms; a one-storey house leaves out the upper floor. */
  plan: SheetPlan;
}

export const projects: readonly Project[] = [casaEnL, casaLoteAngosto, casaPatio];

const squareMetres = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/** "Casa [nombre] · [localidad] · [m²] m²". */
export const projectTitle = (project: Project) =>
  `Casa ${project.name} · ${project.place} · ${squareMetres.format(project.area)} m²`;
