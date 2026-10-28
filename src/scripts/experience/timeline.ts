import { gsap } from 'gsap';
import { sceneSpans, scrollScreens, type SceneId } from './scenes';
import type { ExperienceState } from './state';

/*
 * The master timeline: all eight scenes on one gsap timeline scrubbed by the
 * scroll over the whole story. Time is measured in screens of scroll, so a
 * scene's tweens sit at the same place as its section in the page. Each
 * scene animates the state from where the previous one left it.
 */

export interface TimelineTargets {
  story: HTMLElement;
  /** The sentence container of each scene that has one. */
  content: Partial<Record<SceneId, HTMLElement>>;
  hint: HTMLElement | null;
}

export interface TimelineOptions {
  state: ExperienceState;
  height: number;
  reducedMotion: boolean;
  onUpdate(progress: number): void;
}

const at = (id: SceneId, fraction = 0) => {
  const span = sceneSpans().find((candidate) => candidate.id === id)!;
  const total = scrollScreens();
  return (span.start + (span.end - span.start) * fraction) * total;
};

/** A sentence settles in from below and leaves upwards, slowly. */
function sentence(tl: gsap.core.Timeline, element: HTMLElement | undefined, inAt: number | null, outAt: number | null) {
  if (!element) return;
  // The layer words are fixed to the viewport: any transform on their container, even a zero one,
  // would become their containing block and shift them off their layers.
  const move = !element.querySelector('[data-layer-words]');
  const shift = (y: number) => (move ? { y } : {});
  if (inAt !== null) {
    tl.fromTo(
      element,
      { opacity: 0, ...shift(28) },
      { opacity: 1, ...shift(0), duration: 0.3, ease: 'power2.out', immediateRender: false },
      inAt,
    );
  }
  if (outAt !== null) {
    tl.to(element, { opacity: 0, ...shift(-18), duration: 0.25, ease: 'power2.in' }, outAt);
  }
}

export function createTimeline(targets: TimelineTargets, options: TimelineOptions) {
  const { state, height, reducedMotion } = options;
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    // The timeline's own update, not the trigger's: the scrub keeps easing towards the
    // scroll position after the scroll itself has stopped, and every one of those steps must be drawn.
    onUpdate: () => options.onUpdate(tl.progress()),
    scrollTrigger: {
      trigger: targets.story,
      start: 'top top',
      end: 'bottom bottom',
      scrub: reducedMotion ? true : 0.6,
    },
  });
  const total = scrollScreens();

  if (reducedMotion) {
    // The building is finished from the start; only the light follows the scroll.
    tl.to(state, { sunAzimuth: -1.1, sunElevation: 0.36, duration: total }, 0);
    tl.to(state, { interior: 1, duration: total * 0.3 }, total * 0.45);
    tl.set({}, {}, total);
    return tl;
  }

  const c = targets.content;
  const span = (id: SceneId, from: number, to: number) => [at(id, from), at(id, to) - at(id, from)] as const;
  const put = (id: SceneId, from: number, to: number, vars: gsap.TweenVars) => {
    const [position, duration] = span(id, from, to);
    tl.to(state, { duration, ...vars }, position);
  };

  // 1 · El vacío. The plot is drawn (by the intro); scrolling only lets the sentence go.
  if (targets.hint) tl.fromTo(targets.hint, { opacity: 1 }, { opacity: 0, duration: 0.15, immediateRender: false }, 0);
  sentence(tl, c.vacio, null, at('vacio', 0.3));
  put('vacio', 0.3, 0.8, { point: 0 });
  put('vacio', 0.35, 1, { azimuth: 0.5, elevation: 0.4, distance: 44, targetY: 2.4, frameY: 0, ease: 'power1.inOut' });

  // 2 · Las líneas. The scroll draws; stopping leaves a stroke halfway.
  put('lineas', 0, 0.92, { sketchDraw: 1 });
  put('lineas', 0, 1, { azimuth: 0.64, elevation: 0.36 });
  put('lineas', 0.35, 1, { ground: 0.55 });

  // 3 · La extrusión. The lines rise into frosted walls; the camera orbits very slowly.
  put('extrusion', 0, 0.72, { grow: height, ease: 'power1.inOut' });
  put('extrusion', 0.3, 1, { sketchOpacity: 0.28, siteOpacity: 0.4 });
  put('extrusion', 0, 1, { azimuth: 1.02, elevation: 0.3, distance: 40, targetY: 3 });
  put('extrusion', 0, 0.45, { frameX: 0.13, ground: 1, ease: 'power1.inOut' });
  sentence(tl, c.extrusion, at('extrusion', 0.22), at('extrusion', 0.8));

  // 4 · La materia. Three waves sweep up the volume: concrete, then wood, then glass.
  put('materia', 0.04, 0.9, { wave: 3 });
  put('materia', 0, 0.3, { sketchOpacity: 0 });
  put('materia', 0, 1, { azimuth: 0.74, elevation: 0.22, distance: 40, targetY: 4 });
  put('materia', 0, 0.35, { frameX: -0.13, ease: 'power1.inOut' });
  sentence(tl, c.materia, at('materia', 0.16), at('materia', 0.82));

  // 5 · La luz. The scroll moves the sun; the pointer leans it; the interior lights up.
  put('luz', 0, 0.3, { sunIntensity: 3.1, fill: 0.16, tilt: 1, ease: 'power1.inOut' });
  put('luz', 0, 1, { sunAzimuth: -1.15, sunElevation: 0.36 });
  put('luz', 0, 0.45, { azimuth: 0.3, elevation: 0.15, distance: 36, targetY: 3.4, frameX: 0, ease: 'power1.inOut' });
  put('luz', 0.4, 0.92, { interior: 1 });
  put('luz', 0.88, 1, { tilt: 0 });

  // 6 · El despiece. The layers separate into a live exploded axonometric.
  put('despiece', 0.03, 0.6, { explode: 1, ease: 'power2.inOut' });
  put('despiece', 0, 0.6, {
    azimuth: 0.7,
    elevation: 0.5,
    distance: 82,
    targetY: 14.5,
    frameX: -0.1,
    portraitPull: 0.55,
    sunIntensity: 2.6,
    sunAzimuth: -0.7,
    sunElevation: 0.62,
    ease: 'power2.inOut',
  });
  sentence(tl, c.despiece, at('despiece', 0.5), at('despiece', 0.9));

  // 7 · La mesa. The layers settle back and the building becomes a model on an endless table.
  put('mesa', 0, 0.35, { explode: 0, interior: 0, ease: 'power2.inOut' });
  put('mesa', 0.1, 0.5, { model: 1, table: 1, sunIntensity: 0.7, fill: 0.3, ease: 'power1.inOut' });
  put('mesa', 0, 1, {
    azimuth: 0.42,
    elevation: 0.42,
    distance: 150,
    targetY: 1.2,
    frameX: 0.1,
    portraitPull: 0.8,
    ease: 'power1.inOut',
  });
  sentence(tl, c.mesa, at('mesa', 0.38), at('mesa', 0.85));

  // 8 · El cierre. The building goes back into the ground; the empty plot, from above.
  put('cierre', 0, 0.45, { grow: 0, table: 0, sunIntensity: 1.6, fill: 0.35, ease: 'power1.in' });
  put('cierre', 0.42, 0.46, { model: 0, wave: 0 });
  put('cierre', 0, 0.62, {
    azimuth: 0,
    elevation: 1.28,
    distance: 64,
    targetY: 0,
    frameX: 0,
    portraitPull: 1,
    siteOpacity: 1,
    sunAzimuth: 0.6,
    sunElevation: 0.9,
    ease: 'power2.inOut',
  });
  put('cierre', 0.55, 0.75, { point: 0.85, ease: 'power1.out' });
  sentence(tl, c.cierre, at('cierre', 0.55), null);
  tl.set({}, {}, total);

  return tl;
}
