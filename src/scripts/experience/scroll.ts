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
  start(): void;
  scrollToEnd(): void;
  /** Hands wheel, touch and paging keys to the guided walk along `path`. */
  guide(path: GuidePath): void;
  /** One step down the story, as if the visitor had nudged the wheel. */
  next(): void;
}

export function startScroll(reducedMotion: boolean): Scroll {
  gsap.registerPlugin(ScrollTrigger);
  if (reducedMotion) {
    return {
      lenis: null,
      stop() {},
      start() {},
      scrollToEnd: () => window.scrollTo({ top: document.documentElement.scrollHeight }),
      guide() {},
      next: () => window.scrollBy({ top: innerHeight }),
    };
  }

  let guide: ReturnType<typeof createGuide> | null = null;
  // A step asked for before the walk exists (the hint pressed during the intro) is taken once it does.
  let pending = false;
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
    stop: () => lenis.stop(),
    start: () => lenis.start(),
    scrollToEnd: () => lenis.scrollTo(document.documentElement.scrollHeight, { duration: 2.4 }),
    guide(path) {
      guide = createGuide(lenis, path);
      addEventListener('keydown', guide.keydown);
      if (pending) guide.walk(1);
    },
    next() {
      if (guide) guide.walk(1);
      else pending = true;
    },
  };
}
