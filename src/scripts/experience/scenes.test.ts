import { describe, expect, it } from 'vitest';
import { SCENES, localProgress, sceneAt, sceneSpans, scrollScreens } from './scenes';

describe('scenes', () => {
  it('lists the eight storyboard scenes in order', () => {
    expect(SCENES.map((scene) => scene.id)).toEqual([
      'vacio',
      'lineas',
      'extrusion',
      'materia',
      'luz',
      'despiece',
      'mesa',
      'cierre',
    ]);
  });

  it('spends between eight and ten screens of scroll on the whole journey', () => {
    expect(scrollScreens()).toBeGreaterThanOrEqual(8);
    expect(scrollScreens()).toBeLessThanOrEqual(10);
  });

  it('splits the scroll into contiguous spans from 0 to 1', () => {
    const spans = sceneSpans();
    expect(spans[0].start).toBe(0);
    expect(spans.at(-1)?.end).toBeCloseTo(1, 10);
    for (let i = 1; i < spans.length; i++) expect(spans[i].start).toBeCloseTo(spans[i - 1].end, 10);
  });

  it('names the scene at a scroll progress, clamping outside 0..1', () => {
    const materia = sceneSpans()[3];
    expect(sceneAt(-0.2)).toBe('vacio');
    expect(sceneAt(0)).toBe('vacio');
    expect(sceneAt((materia.start + materia.end) / 2)).toBe('materia');
    expect(sceneAt(1)).toBe('cierre');
    expect(sceneAt(1.3)).toBe('cierre');
  });

  it('gives the progress inside one scene, clamped to 0..1', () => {
    const luz = sceneSpans()[4];
    expect(localProgress(luz.start, 'luz')).toBe(0);
    expect(localProgress((luz.start + luz.end) / 2, 'luz')).toBeCloseTo(0.5, 10);
    expect(localProgress(0, 'luz')).toBe(0);
    expect(localProgress(1, 'luz')).toBe(1);
  });
});
