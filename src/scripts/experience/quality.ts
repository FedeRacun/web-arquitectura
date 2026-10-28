/** What the browser tells us about the device, read once at start. */
export interface DeviceSignals {
  /** `(hover: hover)`: a pointer that can rest over an element. */
  canHover: boolean;
  viewportWidth: number;
  devicePixelRatio: number;
  /** `(prefers-reduced-motion: reduce)`. */
  reducedMotion: boolean;
}

export interface Quality {
  /** `mobile` draws simpler geometry and no shadows. */
  tier: 'desktop' | 'mobile';
  pixelRatio: number;
  shadows: boolean;
  /** No hover: the layer words, the model lift and the closing extrusion answer to taps. */
  touch: boolean;
  /** The building appears finished and only the light follows the scroll. */
  reducedMotion: boolean;
}

/** Below this width the scene uses the degraded tier, whatever the pointer. */
const MOBILE_WIDTH = 768;

export function pickQuality(signals: DeviceSignals): Quality {
  const mobile = signals.viewportWidth < MOBILE_WIDTH;
  return {
    tier: mobile ? 'mobile' : 'desktop',
    pixelRatio: Math.min(signals.devicePixelRatio, mobile ? 1.5 : 2),
    shadows: !mobile,
    touch: !signals.canHover,
    reducedMotion: signals.reducedMotion,
  };
}
