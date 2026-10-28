import { describe, expect, it } from 'vitest';
import { SCENES, localProgress, nextStop, restStops, sceneAt, sceneSpans, scrollScreens } from './scenes';

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

  it('rests at the top, in every scene between and at the end', () => {
    const stops = restStops();
    expect(stops[0]).toBe(0);
    expect(stops.at(-1)).toBeCloseTo(1, 10);
    expect(stops.slice(1, -1).map(sceneAt)).toEqual(['lineas', 'extrusion', 'materia', 'luz', 'despiece', 'mesa']);
    for (let i = 1; i < stops.length; i++) expect(stops[i]).toBeGreaterThan(stops[i - 1]);
  });

  it('rests on the sketch halfway drawn', () => {
    const lineas = restStops()[1];
    expect(localProgress(lineas, 'lineas')).toBeGreaterThan(0.35);
    expect(localProgress(lineas, 'lineas')).toBeLessThan(0.65);
  });

  it('finds the next rest in the direction of the gesture', () => {
    const [top, lineas, extrusion, materia] = restStops();
    expect(nextStop(top, 1)).toBe(lineas);
    expect(nextStop(lineas, 1)).toBe(extrusion);
    expect(nextStop((extrusion + materia) / 2, 1)).toBe(materia);
    expect(nextStop((extrusion + materia) / 2, -1)).toBe(extrusion);
    expect(nextStop(materia, -1)).toBe(extrusion);
  });

  it('treats a rest the scroll is a hair away from as already reached', () => {
    const [, lineas, extrusion, materia] = restStops();
    expect(nextStop(extrusion - 0.001, 1)).toBe(materia);
    expect(nextStop(extrusion + 0.001, -1)).toBe(lineas);
  });

  it('has nowhere to go past the top or the end', () => {
    expect(nextStop(0, -1)).toBeNull();
    expect(nextStop(1, 1)).toBeNull();
  });
});
