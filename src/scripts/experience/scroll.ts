import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createGuide, type GuidePath } from './guide';

/*
 * Lenis drives ScrollTrigger from gsap's ticker, so scroll, timeline and
 * render share one clock. Once guided, a gesture walks the page from one
 * sentence to the next (guide.ts) instead of following the wheel. Reduced
 * motion keeps the browser's own scroll.
 */

export interface Scroll {
  lenis: Lenis | null;
  stop(): void;
  /** Holds the page like stop(), but keeps the next gesture's direction and takes that step on start(). */
  hold(): void;
  start(): void;
  scrollToEnd(): void;
  /** Glides to a story progress (a keyboard user reaching a control in another scene). */
  reach(progress: number): void;
  /** Hands wheel, touch and paging keys to the guided walk along `path`. */
  guide(path: GuidePath): void;
  /** One step down the story, as if the visitor had nudged the wheel. */
  next(): void;
}

export function startScroll(reducedMotion: boolean): Scroll {
  gsap.registerPlugin(ScrollTrigger);
  if (reducedMotion) {
    // The browser's own scroll: held by clipping the page, as Lenis does when it stops.
    const hold = (held: boolean) => document.documentElement.style.setProperty('overflow', held ? 'clip' : null);
    return {
      lenis: null,
      stop: () => hold(true),
      hold: () => hold(true),
      start: () => hold(false),
      scrollToEnd: () => window.scrollTo({ top: document.documentElement.scrollHeight }),
      // Focus already brings the control into view on the browser's own scroll.
      reach() {},
      guide() {},
      next: () => window.scrollBy({ top: innerHeight }),
    };
  }

  let guide: ReturnType<typeof createGuide> | null = null;
  let walked: GuidePath | null = null;
  // A step asked for before the walk can take it is taken once it can: the hint pressed during the intro,
  // or a gesture made while the camera glides back from the other projects (hold()).
  let pending: 1 | -1 | 0 = 0;
  let keeping = false;
  const take = () => {
    if (!guide || !pending || lenis.isStopped) return;
    const direction = pending;
    pending = 0;
    guide.walk(direction);
  };
  const lenis = new Lenis({
    lerp: 0.075,
    wheelMultiplier: 0.85,
    touchMultiplier: 1.2,
    autoRaf: false,
    virtualScroll: (data) => guide?.virtualScroll(data) ?? true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return {
    lenis,
    stop() {
      keeping = false;
      lenis.stop();
    },
    hold() {
      keeping = true;
      pending = 0;
      lenis.stop();
    },
    start() {
      keeping = false;
      lenis.start();
      take();
    },
    scrollToEnd: () => lenis.scrollTo(document.documentElement.scrollHeight, { duration: 2.4 }),
    reach(progress) {
      if (walked) lenis.scrollTo(walked.toScroll(progress), { duration: 2.4 });
    },
    guide(path) {
      walked = path;
      guide = createGuide(lenis, path, (direction) => {
        if (keeping) pending = direction;
        return keeping;
      });
      addEventListener('keydown', guide.keydown);
      take();
    },
    next() {
      pending = 1;
      take();
    },
  };
}
