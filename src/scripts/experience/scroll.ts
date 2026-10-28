import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/*
 * Lenis smooths the wheel into a slow, weighted glide and drives
 * ScrollTrigger from gsap's ticker, so scroll, timeline and render share one
 * clock. Reduced motion keeps the browser's own scroll.
 */

export interface Scroll {
  lenis: Lenis | null;
  stop(): void;
  start(): void;
  scrollToEnd(): void;
}

export function startScroll(reducedMotion: boolean): Scroll {
  gsap.registerPlugin(ScrollTrigger);
  if (reducedMotion) {
    return {
      lenis: null,
      stop() {},
      start() {},
      scrollToEnd: () => window.scrollTo({ top: document.documentElement.scrollHeight }),
    };
  }

  const lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.85, touchMultiplier: 1.2, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return {
    lenis,
    stop: () => lenis.stop(),
    start: () => lenis.start(),
    scrollToEnd: () => lenis.scrollTo(document.documentElement.scrollHeight, { duration: 2.4 }),
  };
}
