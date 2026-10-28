/*
 * Every number the scene is drawn from. The master timeline scrubs most of
 * them with the scroll; pointer interactions own the last few (lift,
 * ctaGrow, tilt, hover) so the two never fight over the same value. Each
 * frame, main.ts writes the state into uniforms, transforms and lights.
 */

export function createState() {
  return {
    // Camera: an orbit around a target, plus a framing shift that moves the
    // subject left or right of centre without changing the perspective.
    azimuth: 0.32,
    elevation: 0.5,
    distance: 50,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    frameX: 0,
    /** Scene 1 lifts the plot clear of the sentence block below it; the preloader's point sits at the same height. */
    frameY: -0.18,
    /** How much of the portrait pull-back applies: tall subjects (the exploded stack) need less of it. */
    portraitPull: 1,

    // Scene 1: the point of light and the plot outline it draws.
    point: 0,
    pointTravel: 0,
    siteDraw: 0,
    siteOpacity: 1,

    // The building: its sketch, the plan drafted on the plot, then the volume.
    sketchDraw: 0,
    sketchOpacity: 1,
    plan: 0,
    planOpacity: 1,
    grow: 0,
    wave: 0,
    interior: 0,
    model: 0,
    explode: 0,

    // Light and ground.
    sunAzimuth: 0.9,
    sunElevation: 0.62,
    sunIntensity: 1.2,
    fill: 0.35,
    tilt: 0,
    ground: 0,
    table: 0,

    // Owned by interactions, not the scroll.
    tiltX: 0,
    tiltY: 0,
    lift: 0,
    ctaGrow: 0,
    /**
     * How far the camera has left the timeline's view for the other projects' (projects.ts), 0..1.
     * Blended over the timeline's values, so the two never fight; the scroll is stopped meanwhile.
     */
    aside: 0,
  };
}

export type ExperienceState = ReturnType<typeof createState>;
