/*
 * The storyboard's timing. Each scene owns a share of the scroll, measured in
 * screens: the page is that many screens tall plus the last one, so the
 * scroll distance equals the sum. The HTML sizes its sections from this list
 * and the master timeline places each scene at the same fraction, so DOM and
 * scene never drift apart.
 */

export const SCENES = [
  { id: 'vacio', screens: 1 },
  { id: 'lineas', screens: 1.2 },
  { id: 'extrusion', screens: 1.2 },
  { id: 'materia', screens: 1.5 },
  { id: 'luz', screens: 1.2 },
  { id: 'despiece', screens: 1.5 },
  { id: 'mesa', screens: 1.2 },
  { id: 'cierre', screens: 1 },
] as const;

export type SceneId = (typeof SCENES)[number]['id'];

export interface SceneSpan {
  id: SceneId;
  /** Scroll progress (0..1 over the whole page) where the scene starts. */
  start: number;
  end: number;
}

/** Screens of scroll from the top of the page to the bottom. */
export const scrollScreens = () => SCENES.reduce((sum, scene) => sum + scene.screens, 0);

const SPANS: readonly SceneSpan[] = (() => {
  const total = scrollScreens();
  let start = 0;
  return SCENES.map((scene) => {
    const span = { id: scene.id, start: start / total, end: (start + scene.screens) / total };
    start += scene.screens;
    return span;
  });
})();

export const sceneSpans = () => SPANS;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export function sceneAt(progress: number): SceneId {
  const p = clamp01(progress);
  return (SPANS.find((span) => p < span.end) ?? SPANS[SPANS.length - 1]).id;
}

export function localProgress(progress: number, id: SceneId): number {
  const span = SPANS.find((candidate) => candidate.id === id);
  if (!span) throw new Error(`Unknown scene: ${id}`);
  return clamp01((progress - span.start) / (span.end - span.start));
}
