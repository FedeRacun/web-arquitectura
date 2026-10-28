import { architect } from '../../config/architect';
import { sheetBounds, type SheetPlan } from '../../scripts/experience/building/plan';

/*
 * The plan sheets the dev viewer shows: the main house, then every project
 * in src/config/projects/ that carries a plan. A project file exports
 * `project = { id, name, place, area, status, site: { width, depth }, plan }`;
 * while one is being drafted any field but the plan may be missing, and a
 * file without a plan is skipped.
 */

export interface DevSheet {
  id: string;
  name: string;
  plan: SheetPlan;
  site: { readonly width: number; readonly depth: number };
}

interface ProjectModule {
  project?: { id?: string; name?: string; site?: { width: number; depth: number }; plan?: SheetPlan };
}

/** Room for the notes around a project's plan, when the project names no plot yet. */
const MARGIN = 6;

export function devSheets(): DevSheet[] {
  const modules = import.meta.glob<ProjectModule>('../../config/projects/*.ts', { eager: true });
  const projects = Object.entries(modules).flatMap(([path, module]): DevSheet[] => {
    const project = module.project;
    if (!project?.plan) return [];
    const id = project.id ?? path.replace(/^.*\/|\.ts$/g, '');
    const { x, z } = sheetBounds(project.plan);
    const site = project.site ?? { width: x[1] - x[0] + 2 * MARGIN, depth: z[1] - z[0] + 2 * MARGIN };
    return [{ id, name: project.name ?? id, plan: project.plan, site }];
  });
  projects.sort((a, b) => a.id.localeCompare(b.id));
  return [{ id: 'main', name: 'Main house', plan: architect.building.plan, site: architect.building.site }, ...projects];
}
