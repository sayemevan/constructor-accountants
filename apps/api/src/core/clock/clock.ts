/**
 * The source of "now" (13, ADR-0017). Inject it instead of calling `new Date()` / `Date.now()`, so time-dependent
 * code is testable with a fixed clock. Domain functions still take `today`/`now` as arguments.
 */
export abstract class Clock {
  /** The current instant. */
  abstract now(): Date;

  /** The current business date (`YYYY-MM-DD`) in an IANA time zone, e.g. the tenant's `Asia/Dhaka`. */
  today(timeZone: string): string {
    return businessDate(this.now(), timeZone);
  }
}

/** The real clock. */
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

/** The calendar date of `instant` in `timeZone`, as `YYYY-MM-DD`. Throws a RangeError for an unknown zone. */
export function businessDate(instant: Date, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}
