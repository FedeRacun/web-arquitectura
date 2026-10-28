import { describe, expect, it } from 'vitest';
import { architect } from '../../../config/architect';
import { LAYERS, deriveBuilding, type Box } from './params';

const full = deriveBuilding(architect.building, 'full');
const low = deriveBuilding(architect.building, 'low');

const inside = (box: Box, bounds: Box) =>
  box.min.every((value, axis) => value >= bounds.min[axis] - 1e-9) &&
  box.max.every((value, axis) => value <= bounds.max[axis] + 1e-9);

describe('deriveBuilding', () => {
  it('fills the four exploded layers in order', () => {
    expect(LAYERS).toEqual(['estructura', 'envolvente', 'luz', 'habitar']);
    for (const layer of LAYERS) expect(full.parts.some((part) => part.layer === layer)).toBe(true);
  });

  it('uses concrete, wood and glass so each material wave has something to cover', () => {
    for (const kind of ['concrete', 'wood', 'glass'] as const) {
      expect(full.parts.some((part) => part.kind === kind)).toBe(true);
    }
  });

  it('gives every part a positive size', () => {
    for (const part of full.parts) {
      part.box.min.forEach((value, axis) => expect(part.box.max[axis]).toBeGreaterThan(value));
    }
  });

  it('keeps the whole building on the site', () => {
    const site: Box = {
      min: [-architect.building.site.width / 2, 0, -architect.building.site.depth / 2],
      max: [architect.building.site.width / 2, full.height, architect.building.site.depth / 2],
    };
    for (const part of full.parts) expect(inside(part.box, site)).toBe(true);
  });

  it('cantilevers the upper bar past the base', () => {
    const [base, upper] = full.volumes;
    expect(upper.max[0] - base.max[0]).toBeGreaterThan(3);
    expect(upper.min[1]).toBeCloseTo(base.max[1], 10);
  });

  it('is as tall as the blade wall', () => {
    expect(full.height).toBe(architect.building.blade.height);
  });

  it('draws fewer parts in the low-detail tier', () => {
    expect(low.parts.length).toBeLessThan(full.parts.length);
  });

  it('sketches vertical lines before horizontal ones, all over the site', () => {
    const firstHorizontal = full.sketch.findIndex((line) => line.direction === 'horizontal');
    expect(firstHorizontal).toBeGreaterThan(0);
    expect(full.sketch.slice(firstHorizontal).every((line) => line.direction === 'horizontal')).toBe(true);
    for (const line of full.sketch) {
      expect(Math.abs(line.from[0])).toBeLessThanOrEqual(architect.building.site.width / 2 + 2);
      expect(Math.abs(line.to[2])).toBeLessThanOrEqual(architect.building.site.depth / 2 + 2);
    }
  });

  it('measures each layer for the exploded view and its words', () => {
    for (const layer of LAYERS) {
      const bounds = full.layerBounds[layer];
      expect(bounds.max[1]).toBeGreaterThan(bounds.min[1]);
    }
  });
});
