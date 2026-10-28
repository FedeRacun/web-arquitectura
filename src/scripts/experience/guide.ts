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

/** Slow, and slower over a longer distance, but never a wait. */
export function glideSeconds(screens: number) {
  return Math.min(Math.max(0.6 + 0.9 * screens, 1.6), 3.4);
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

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
/** A walk carried on mid-glide is already moving: it only needs to slow down. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

const PAGING_KEYS: Record<string, 1 | -1> = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };

export interface GuidePath {
  /** Scroll position (px) of a story progress, and back. */
  toScroll(progress: number): number;
  toProgress(scroll: number): number;
}

export function createGuide(lenis: Lenis, path: GuidePath) {
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
      easing: onward ? easeOut : easeInOut,
      onComplete: () => {
        heading = null;
      },
    });
  };

  return {
    /** Lenis's hook for every wheel and touch event; false keeps Lenis from scrolling by itself. */
    virtualScroll({ deltaY, event }: VirtualScrollData): boolean {
      // The intro holds the page (Lenis swallows the event); pinch-zoom stays the browser's.
      if (lenis.isStopped || event.ctrlKey || ('touches' in event && event.touches.length > 1)) return true;
      // Stop the browser's own scroll; touchstart and touchend stay untouched so taps still click.
      if (event.cancelable && (event.type === 'wheel' || event.type === 'touchmove')) event.preventDefault();
      const direction = gate.feed(event.type, deltaY, event.timeStamp);
      if (direction) walk(direction);
      return false;
    },
    keydown(event: KeyboardEvent) {
      if (lenis.isStopped || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest('button, input, select, textarea, [contenteditable]')) return;
      let direction = PAGING_KEYS[event.key];
      if (!direction) return;
      if (event.key === ' ' && event.shiftKey) direction = -1;
      event.preventDefault();
      if (!event.repeat) walk(direction);
    },
  };
}
