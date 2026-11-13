const TWO_PI = 2 * Math.PI;

/**
 * Wraps an angle to (−π, π].
 *
 * @param angle - Angle in radians.
 * @returns The same direction in (−π, π] radians: `0` (never `-0`) at multiples of 2π,
 *   and `NaN` for non-finite input.
 */
export function normalizeAngle(angle: number): number {
  const wrapped = angle % TWO_PI;
  if (wrapped <= -Math.PI) return wrapped + TWO_PI;
  if (wrapped > Math.PI) return wrapped - TWO_PI;
  return wrapped + 0; // turns -0 into 0
}

/**
 * The signed shortest rotation that takes `b` onto `a`.
 *
 * @param a - Target angle in radians.
 * @param b - Start angle in radians.
 * @returns `a − b` wrapped to (−π, π] radians; positive is counter-clockwise.
 */
export function angleDiff(a: number, b: number): number {
  return normalizeAngle(a - b);
}
