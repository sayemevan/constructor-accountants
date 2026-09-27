import { afterEach, describe, expect, it, vi } from 'vitest';

import { FixedClock } from '../../../testing/fixed-clock.js';
import { businessDate, SystemClock } from '../clock.js';

describe('businessDate', () => {
  // 2026-03-31 20:30 UTC is already 1 April in Dhaka (UTC+6) but still 31 March in New York.
  const instant = new Date('2026-03-31T20:30:00.000Z');

  it('uses the calendar date of the given time zone, not UTC', () => {
    expect(businessDate(instant, 'Asia/Dhaka')).toBe('2026-04-01');
    expect(businessDate(instant, 'UTC')).toBe('2026-03-31');
    expect(businessDate(instant, 'America/New_York')).toBe('2026-03-31');
  });

  it('handles leap days', () => {
    expect(businessDate(new Date('2028-02-29T12:00:00.000Z'), 'UTC')).toBe('2028-02-29');
  });

  it('rejects an unknown time zone', () => {
    expect(() => businessDate(instant, 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('SystemClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads the system time', () => {
    vi.useFakeTimers({ now: new Date('2026-06-01T23:30:00.000Z') });
    const clock = new SystemClock();
    expect(clock.now().toISOString()).toBe('2026-06-01T23:30:00.000Z');
    expect(clock.today('Asia/Dhaka')).toBe('2026-06-02');
  });
});

describe('FixedClock', () => {
  it('stays put until set or advanced', () => {
    const clock = new FixedClock('2026-01-15T09:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-01-15T09:00:00.000Z');

    clock.advance(15 * 60 * 60 * 1000);
    expect(clock.now().toISOString()).toBe('2026-01-16T00:00:00.000Z');
    expect(clock.today('UTC')).toBe('2026-01-16');

    clock.set('2027-12-31T18:00:00.000Z');
    expect(clock.today('Asia/Dhaka')).toBe('2028-01-01');
  });

  it('returns a copy, so callers cannot move the clock by mutating the result', () => {
    const clock = new FixedClock('2026-01-15T09:00:00.000Z');
    clock.now().setUTCFullYear(1999);
    expect(clock.now().toISOString()).toBe('2026-01-15T09:00:00.000Z');
  });
});
