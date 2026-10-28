import { describe, expect, it } from 'vitest';
import { pickQuality, type DeviceSignals } from './quality';

const desktop: DeviceSignals = {
  canHover: true,
  viewportWidth: 1440,
  devicePixelRatio: 2,
  reducedMotion: false,
};

const phone: DeviceSignals = {
  canHover: false,
  viewportWidth: 390,
  devicePixelRatio: 3,
  reducedMotion: false,
};

describe('pickQuality', () => {
  it('gives a desktop full detail, shadows and pixel ratio up to 2', () => {
    expect(pickQuality(desktop)).toEqual({
      tier: 'desktop',
      pixelRatio: 2,
      shadows: true,
      touch: false,
      reducedMotion: false,
    });
  });

  it('gives a phone the degraded tier: no shadows, pixel ratio capped at 1.5, tap instead of hover', () => {
    expect(pickQuality(phone)).toEqual({
      tier: 'mobile',
      pixelRatio: 1.5,
      shadows: false,
      touch: true,
      reducedMotion: false,
    });
  });

  it('never raises the pixel ratio above the display', () => {
    expect(pickQuality({ ...phone, devicePixelRatio: 1 }).pixelRatio).toBe(1);
  });

  it('keeps hover on a narrow desktop window while using the degraded tier', () => {
    const quality = pickQuality({ ...desktop, viewportWidth: 700, devicePixelRatio: 1 });
    expect(quality.tier).toBe('mobile');
    expect(quality.touch).toBe(false);
  });

  it('treats a large touch screen without hover as touch, with desktop detail', () => {
    const quality = pickQuality({ ...phone, viewportWidth: 1024, devicePixelRatio: 2 });
    expect(quality.tier).toBe('desktop');
    expect(quality.touch).toBe(true);
  });

  it('passes reduced motion through', () => {
    expect(pickQuality({ ...desktop, reducedMotion: true }).reducedMotion).toBe(true);
  });
});
