import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { angleDiff, normalizeAngle } from './angle';

const PI = Math.PI;
const anyAngle = fc.double({ min: -1e6, max: 1e6, noNaN: true });
const nearAngle = fc.double({ min: -100, max: 100, noNaN: true });

describe('normalizeAngle', () => {
  it.each([
    [0, 0],
    [PI, PI],
    [-PI, PI],
    [3 * PI, PI],
    [-3 * PI, PI],
    [(5 * PI) / 2, PI / 2],
    [(-3 * PI) / 2, PI / 2],
    [7, 7 - 2 * PI],
  ])('maps %f to %f', (angle, expected) => {
    expect(normalizeAngle(angle)).toBeCloseTo(expected, 12);
  });

  it('returns 0, not -0, for -2π', () => {
    expect(normalizeAngle(-2 * PI)).toBe(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'returns NaN for %f',
    (angle) => {
      expect(normalizeAngle(angle)).toBeNaN();
    },
  );

  it('always lands in (-π, π]', () => {
    fc.assert(
      fc.property(anyAngle, (angle) => {
        const result = normalizeAngle(angle);
        expect(result).toBeGreaterThan(-PI);
        expect(result).toBeLessThanOrEqual(PI);
      }),
    );
  });

  it('keeps the direction', () => {
    fc.assert(
      fc.property(anyAngle, (angle) => {
        const result = normalizeAngle(angle);
        expect(Math.cos(result)).toBeCloseTo(Math.cos(angle), 9);
        expect(Math.sin(result)).toBeCloseTo(Math.sin(angle), 9);
      }),
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(anyAngle, (angle) => {
        expect(normalizeAngle(normalizeAngle(angle))).toBe(normalizeAngle(angle));
      }),
    );
  });
});

describe('angleDiff', () => {
  it('is 0 between an angle and itself', () => {
    fc.assert(
      fc.property(anyAngle, (angle) => {
        expect(angleDiff(angle, angle)).toBe(0);
      }),
    );
  });

  it('takes the short way across the ±π seam', () => {
    expect(angleDiff(PI - 0.1, -PI + 0.1)).toBeCloseTo(-0.2, 12);
    expect(angleDiff(-PI + 0.1, PI - 0.1)).toBeCloseTo(0.2, 12);
  });

  it('is the rotation in (-π, π] that takes b onto a', () => {
    fc.assert(
      fc.property(nearAngle, nearAngle, (a, b) => {
        const diff = angleDiff(a, b);
        expect(diff).toBeGreaterThan(-PI);
        expect(diff).toBeLessThanOrEqual(PI);
        expect(angleDiff(b + diff, a)).toBeCloseTo(0, 9);
      }),
    );
  });
});
