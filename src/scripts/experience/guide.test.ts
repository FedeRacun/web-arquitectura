import { describe, expect, it } from 'vitest';
import { createGestureGate, glideEasing, glideSeconds } from './guide';

/** Average speed of the easing between two moments of the glide. */
const pace = (from: number, to: number) => (glideEasing(to) - glideEasing(from)) / (to - from);

describe('glideEasing', () => {
  it('runs from the start to the stop and never backs up', () => {
    expect(glideEasing(0)).toBe(0);
    expect(glideEasing(1)).toBeCloseTo(1, 10);
    for (let t = 0.01; t <= 1; t += 0.01) expect(glideEasing(t)).toBeGreaterThanOrEqual(glideEasing(t - 0.01));
  });

  it('starts fast', () => {
    expect(pace(0, 0.04)).toBeGreaterThan(2.5 * pace(0.45, 0.55));
  });

  it('settles into an even pace while the scene plays', () => {
    expect(pace(0.7, 0.8) / pace(0.4, 0.5)).toBeGreaterThan(0.9);
    expect(pace(0.7, 0.8) / pace(0.4, 0.5)).toBeLessThanOrEqual(1);
  });

  it('lands softly on the stop', () => {
    expect(pace(0.98, 1)).toBeLessThan(0.25 * pace(0.45, 0.55));
  });
});

describe('glideSeconds', () => {
  it('keeps the same cruising speed over any distance', () => {
    expect(glideSeconds(1.7) / 1.7).toBeCloseTo(glideSeconds(1.2) / 1.2, 10);
  });

  it('never rushes a short hop nor drags a long one', () => {
    expect(glideSeconds(0.1)).toBe(1.2);
    expect(glideSeconds(20)).toBe(4);
  });
});

describe('createGestureGate', () => {
  it('starts a walk on the first wheel nudge, downwards or upwards', () => {
    expect(createGestureGate().feed('wheel', 40, 0)).toBe(1);
    expect(createGestureGate().feed('wheel', -40, 0)).toBe(-1);
  });

  it('swallows the rest of a wheel gesture and its trailing inertia', () => {
    const gate = createGestureGate();
    expect(gate.feed('wheel', 40, 0)).toBe(1);
    for (let t = 16; t < 1500; t += 16) expect(gate.feed('wheel', 30, t)).toBe(0);
  });

  it('starts the next walk once the wheel has paused', () => {
    const gate = createGestureGate();
    gate.feed('wheel', 40, 0);
    gate.feed('wheel', 30, 100);
    expect(gate.feed('wheel', 30, 400)).toBe(1);
  });

  it('waits for a few pixels of trackpad travel before starting', () => {
    const gate = createGestureGate();
    expect(gate.feed('wheel', 1, 0)).toBe(0);
    expect(gate.feed('wheel', 2, 16)).toBe(0);
    expect(gate.feed('wheel', 2, 32)).toBe(1);
  });

  it('lets a tap through: a touch walks only after a real drag', () => {
    const gate = createGestureGate();
    expect(gate.feed('touchstart', 0, 0)).toBe(0);
    expect(gate.feed('touchmove', 4, 16)).toBe(0);
    expect(gate.feed('touchend', 4, 32)).toBe(0);
    expect(gate.feed('touchstart', 0, 500)).toBe(0);
    expect(gate.feed('touchmove', 8, 516)).toBe(0);
    expect(gate.feed('touchmove', 8, 532)).toBe(1);
  });

  it('walks once per swipe, and again on the next swipe', () => {
    const gate = createGestureGate();
    gate.feed('touchstart', 0, 0);
    expect(gate.feed('touchmove', -20, 16)).toBe(-1);
    expect(gate.feed('touchmove', -20, 32)).toBe(0);
    expect(gate.feed('touchend', -20, 48)).toBe(0);
    gate.feed('touchstart', 0, 60);
    expect(gate.feed('touchmove', -20, 76)).toBe(-1);
  });
});
