/*
 * The storyboard's timing. Each scene owns a share of the scroll, measured in
 * screens: the page is that many screens tall plus the last one, so the
 * scroll distance equals the sum. The HTML sizes its sections from this list
 * and the master timeline places each scene at the same fraction, so DOM and
 * scene never drift apart.
 *
 * `rest` is where the guided scroll stops in a scene (see timeline.ts). In a
 * scene with a sentence, just before the sentence leaves, when the scene has
 * played out and its sentence is still on screen. Luz has no sentence but
 * rests too, with the sun halfway across, the interior lighting up and the
 * light leaning to the pointer. Líneas rests only at its end, on the finished
 * ground floor plan seen from above: the sketch before it is drawn on the way,
 * since a half-drawn sketch the visitor did not choose to stop on reads as empty.
 */

export const SCENES = [
  { id: 'vacio', screens: 1, rest: 0 },
  { id: 'lineas', screens: 1.2, rest: 0.95 },
  { id: 'extrusion', screens: 1.2, rest: 0.76 },
  { id: 'materia', screens: 1.5, rest: 0.78 },
  { id: 'luz', screens: 1.2, rest: 0.66 },
  { id: 'despiece', screens: 1.5, rest: 0.86 },
  { id: 'mesa', screens: 1.2, rest: 0.8 },
  { id: 'cierre', screens: 1, rest: 1 },
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

const STOPS: readonly number[] = SCENES.flatMap((scene, index) =>
  'rest' in scene ? [SPANS[index].start + (SPANS[index].end - SPANS[index].start) * scene.rest] : [],
);

/** Scroll progress of every rest, top to bottom. */
export const restStops = () => STOPS;

/** A rest closer than this (about a twentieth of a screen) counts as reached. */
const REACHED = 0.005;

/** The next rest from `progress` in the gesture's direction, or null past the first or the last. */
export function nextStop(progress: number, direction: 1 | -1): number | null {
  if (direction > 0) return STOPS.find((stop) => stop > progress + REACHED) ?? null;
  return STOPS.findLast((stop) => stop < progress - REACHED) ?? null;
}
