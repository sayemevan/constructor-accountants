import { describe, expect, it } from 'vitest';

import { assertEventType } from '../outbox-event.js';

describe('assertEventType', () => {
  it.each(['ProjectCreated', 'PayrollRunApproved', 'SalaryDue'])('accepts %s', (type) => {
    expect(() => {
      assertEventType(type);
    }).not.toThrow();
  });

  it.each(['projectCreated', 'project.created', 'Project Created', 'P', ''])(
    'rejects "%s"',
    (type) => {
      expect(() => {
        assertEventType(type);
      }).toThrow(TypeError);
    },
  );
});
