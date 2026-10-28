import { pickQuality } from './experience/quality';

/*
 * Starts the scene after the first paint. The page paints with the point of
 * light already on screen; three.js, gsap and Lenis load behind it. If WebGL
 * cannot start, the experience steps aside and the page reads as a plain
 * sequence of sentences with a working WhatsApp link.
 */

const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export async function bootExperience() {
  const root = document.documentElement;
  const canvas = document.querySelector<HTMLCanvasElement>('[data-scene-canvas]');
  const story = document.querySelector<HTMLElement>('[data-story]');
  if (!root.classList.contains('js-experience') || !canvas || !story) return;

  const preloader = document.querySelector<HTMLElement>('[data-preloader]');
  const quality = pickQuality({
    canHover: matchMedia('(hover: hover)').matches,
    viewportWidth: innerWidth,
    devicePixelRatio: devicePixelRatio || 1,
    reducedMotion: root.classList.contains('reduced-motion'),
  });

  await nextPaint();
  try {
    const { startExperience } = await import('./experience/main');
    await startExperience(
      {
        canvas,
        story,
        preloader,
        hint: document.querySelector<HTMLElement>('[data-scroll-hint]'),
        cta: document.querySelector<HTMLElement>('[data-cta]'),
      },
      quality,
    );
  } catch (error) {
    console.error('The 3D scene could not start; showing the static page instead.', error);
    root.classList.remove('js-experience', 'reduced-motion');
    preloader?.remove();
  }
}
