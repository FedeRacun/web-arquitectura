import { describe, expect, it } from 'vitest';
import { createGestureGate, glideSeconds } from './guide';

describe('glideSeconds', () => {
  it('takes longer over a longer distance', () => {
    expect(glideSeconds(2.5)).toBeGreaterThan(glideSeconds(1.2));
  });

  it('stays slow on a short hop and bounded on a long one', () => {
    expect(glideSeconds(0.1)).toBe(1.6);
    expect(glideSeconds(20)).toBe(3.4);
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
