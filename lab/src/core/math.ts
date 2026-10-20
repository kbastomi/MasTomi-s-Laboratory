/** Small maths helpers used across the labs. */

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Frame-rate independent exponential smoothing. */
export const smooth = (current: number, target: number, dt: number, speed: number): number =>
  current + (target - current) * (1 - Math.exp(-dt * speed))

/** Smooth saturation mapping a value into (-1..1). */
export const tanh = (x: number): number => Math.tanh(x)

/** Rotate a 2D vector by an angle (radians). */
export function rot2(x: number, y: number, a: number): { x: number; y: number } {
  return {
    x: x * Math.cos(a) - y * Math.sin(a),
    y: x * Math.sin(a) + y * Math.cos(a),
  }
}

/** Gravity, metres per second squared. */
export const G = 9.81

/** Format a number with a fixed number of decimals, without locale separators. */
export const nf = (v: number, d = 1): string => Number(v).toFixed(d)
