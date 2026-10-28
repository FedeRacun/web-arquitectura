import type Lenis from 'lenis';
import type { VirtualScrollData } from 'lenis';
import { nextStop, scrollScreens } from './scenes';

/*
 * The scroll as a guided walk. The first nudge of a gesture (a wheel turn, a
 * swipe, a paging key) carries the page slowly to the next scene's rest (see
 * scenes.ts) and stops there; the rest of that gesture and a trackpad's trailing inertia are
 * swallowed. A new gesture walks on, or turns the walk round. The scrollbar,
 * Home and End still move freely; the next gesture walks on from wherever the
 * page was left.
 */

/** A wheel that has been still this long has ended its gesture. */
const QUIET_MS = 220;
/** Travel before a gesture counts: a trackpad's first flutter, a finger's tap. */
const WHEEL_TRAVEL = 4;
const TOUCH_TRAVEL = 12;

/*
 * The glide's pace: off the mark fast, so the gesture is answered at once;
 * then an even, slow cruise while the scene plays, so no animation is rushed;
 * then a soft landing on the stop.
 */
/** Speed of the cruise, in screens of scroll per second. */
const CRUISE = 0.55;
/** Extra speed off the mark, in cruise speeds; it fades over about a tenth of the glide. */
const BURST = 4;
const BURST_FADE = 0.1;
/** Closing share of the glide that slows to a stop. */
const LANDING = 0.15;

const speed = (t: number) => {
  const pace = 1 + BURST * Math.exp(-t / BURST_FADE);
  const landing = (t - (1 - LANDING)) / LANDING;
  return landing > 0 ? pace * 0.5 * (1 + Math.cos(Math.PI * landing)) : pace;
};

// The easing is the integral of that speed, tabulated once and normalised to end at 1.
const STEPS = 256;
const TRAVELLED = [0];
for (let i = 1; i <= STEPS; i++) TRAVELLED.push(TRAVELLED[i - 1] + speed((i - 0.5) / STEPS) / STEPS);
const TOTAL = TRAVELLED[STEPS];

export function glideEasing(t: number) {
  const x = Math.min(Math.max(t, 0), 1) * STEPS;
  const i = Math.min(Math.floor(x), STEPS - 1);
  return (TRAVELLED[i] + (TRAVELLED[i + 1] - TRAVELLED[i]) * (x - i)) / TOTAL;
}

/** Long enough that the cruise runs at CRUISE whatever the distance; bounded for a short hop or a long chain. */
export function glideSeconds(screens: number) {
  return Math.min(Math.max(screens / TOTAL / CRUISE, 1.2), 4);
}

/** Lets through the first real move of each gesture as a direction to walk in; 0 for everything else. */
export function createGestureGate() {
  let lastWheel = -Infinity;
  let travel = 0;
  let spent = false;
  const fresh = () => {
    travel = 0;
    spent = false;
  };
  return {
    feed(type: string, deltaY: number, now: number): -1 | 0 | 1 {
      if (type === 'touchstart') fresh();
      if (type === 'wheel') {
        if (now - lastWheel > QUIET_MS) fresh();
        lastWheel = now;
      }
      if (spent || (type !== 'wheel' && type !== 'touchmove')) return 0;
      travel += deltaY;
      if (Math.abs(travel) < (type === 'wheel' ? WHEEL_TRAVEL : TOUCH_TRAVEL)) return 0;
      spent = true;
      return travel > 0 ? 1 : -1;
    },
  };
}

const PAGING_KEYS: Record<string, 1 | -1> = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };

export interface GuidePath {
  /** Scroll position (px) of a story progress, and back. */
  toScroll(progress: number): number;
  toProgress(scroll: number): number;
}

/**
 * `held` is offered the direction of each gesture made while the page is held (Lenis stopped: the intro,
 * the other projects); it returns true when it keeps the step to take once the page walks again.
 */
export function createGuide(lenis: Lenis, path: GuidePath, held?: (direction: 1 | -1) => boolean) {
  const gate = createGestureGate();
  let heading: number | null = null;

  const walk = (direction: 1 | -1) => {
    const here = path.toProgress(lenis.animatedScroll);
    const gliding = heading !== null && lenis.isScrolling === 'smooth';
    const onward = gliding && Math.sign(heading! - here) === direction;
    const next = nextStop(onward ? heading! : here, direction);
    if (next === null) return;
    heading = next;
    lenis.scrollTo(path.toScroll(next), {
      duration: glideSeconds(Math.abs(next - here) * scrollScreens()),
      // Carried on mid-glide or turned round, every new gesture gets the same quick start.
      easing: glideEasing,
      onComplete: () => {
        heading = null;
      },
    });
  };

  return {
    /** One step in `direction`, as a gesture would take it (the scroll hint's click). */
    walk,
    /** Lenis's hook for every wheel and touch event; false keeps Lenis from scrolling by itself. */
    virtualScroll({ deltaY, event }: VirtualScrollData): boolean {
      // Pinch-zoom stays the browser's.
      if (event.ctrlKey || ('touches' in event && event.touches.length > 1)) return true;
      // A held page swallows the gesture (Lenis does, while stopped), and offers its direction to whoever holds it.
      if (lenis.isStopped) {
        const direction = gate.feed(event.type, deltaY, event.timeStamp);
        if (direction) held?.(direction);
        return true;
      }
      // Stop the browser's own scroll; touchstart and touchend stay untouched so taps still click.
      if (event.cancelable && (event.type === 'wheel' || event.type === 'touchmove')) event.preventDefault();
      const direction = gate.feed(event.type, deltaY, event.timeStamp);
      if (direction) walk(direction);
      return false;
    },
    keydown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const focused = event.target instanceof Element ? event.target : null;
      if (focused?.closest('input, select, textarea, [contenteditable]')) return;
      let direction = PAGING_KEYS[event.key];
      if (!direction) return;
      // Space presses a focused button (the scroll hint); the arrows and Page keys still walk from it.
      if (event.key === ' ' && focused?.closest('button')) return;
      if (event.key === ' ' && event.shiftKey) direction = -1;
      if (lenis.isStopped) {
        if (!event.repeat && held?.(direction)) event.preventDefault();
        return;
      }
      event.preventDefault();
      if (!event.repeat) walk(direction);
    },
  };
}
