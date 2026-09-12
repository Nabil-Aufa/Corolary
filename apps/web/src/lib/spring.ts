/** Longest step integrated at once; a stalled tab or GC pause is capped here. */
const MAX_DT = 1 / 30;

export interface SpringOptions {
  /** Per second squared. */
  stiffness: number;
  /** Per second. */
  damping: number;
  /** Soft limit applied to the target with tanh. */
  inputLimit: number;
  /**
   * When both the distance to the target and the velocity fall below this, the
   * spring snaps onto the target. Without it an exponential decay never reaches
   * zero, and anything driven by the spring keeps moving by fractions of a pixel.
   */
  restDelta: number;
}

export interface Spring {
  readonly value: number;
  /** Advance toward `target` by `dtSeconds` and return the new value. */
  step(target: number, dtSeconds: number): number;
  reset(value?: number): void;
}

/**
 * Damped spring integrated with semi-implicit Euler in real time.
 *
 * Per second rather than per frame, so the same scroll bounces the same way at
 * 60 Hz and 144 Hz. The target is soft-limited with tanh because the inputs are
 * velocities, and one burst of wheel events can be an order of magnitude above
 * a normal flick — a hard clamp would flatten into a visible plateau.
 */
export function createSpring({ stiffness, damping, inputLimit, restDelta }: SpringOptions): Spring {
  let value = 0;
  let velocity = 0;

  return {
    get value() {
      return value;
    },
    step(target, dtSeconds) {
      const dt = Math.min(dtSeconds, MAX_DT);
      if (!(dt > 0)) return value;

      const goal = inputLimit * Math.tanh(target / inputLimit);
      velocity += ((goal - value) * stiffness - velocity * damping) * dt;
      value += velocity * dt;

      if (Math.abs(goal - value) < restDelta && Math.abs(velocity) < restDelta) {
        value = goal;
        velocity = 0;
      }
      return value;
    },
    reset(next = 0) {
      value = next;
      velocity = 0;
    },
  };
}
