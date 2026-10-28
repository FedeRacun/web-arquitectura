/*
 * The CAD crosshair follows the pointer exactly, with no easing: a drafting
 * cursor never lags. It becomes a pick box over links and buttons, and over
 * whatever the scene reports through the `cad-cursor` event (a hovered layer,
 * the model on the table).
 */

const INTERACTIVE = 'a[href], button, [data-cursor-target]';

export interface CadCursorDetail {
  target: boolean;
}

declare global {
  interface WindowEventMap {
    'cad-cursor': CustomEvent<CadCursorDetail>;
  }
}

export function startCadCursor(cursor: HTMLElement | null) {
  if (!cursor || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.documentElement.classList.add('has-cad-cursor');

  let overElement = false;
  let overScene = false;
  const paint = () => cursor.toggleAttribute('data-target', overElement || overScene);

  addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      cursor.style.translate = `${event.clientX}px ${event.clientY}px`;
      cursor.toggleAttribute('data-visible', true);
    },
    { passive: true },
  );

  document.addEventListener('pointerover', (event) => {
    overElement = event.target instanceof Element && event.target.closest(INTERACTIVE) !== null;
    paint();
  });

  document.documentElement.addEventListener('pointerleave', () => cursor.toggleAttribute('data-visible', false));

  addEventListener('cad-cursor', (event) => {
    overScene = event.detail.target;
    paint();
  });
}
