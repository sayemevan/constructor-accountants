import { Clock } from '../core/clock/index.js';

/** A {@link Clock} that only moves when told to (14: "Inject a fixed Clock"). Test-only. */
export class FixedClock extends Clock {
  private current: Date;

  constructor(instant: Date | string = '2026-01-15T09:00:00.000Z') {
    super();
    this.current = new Date(instant);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(instant: Date | string): void {
    this.current = new Date(instant);
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
