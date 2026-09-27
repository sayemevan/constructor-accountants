import { Injectable, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import {
  OutboxEventHandler,
  type OutboxEventHandlerInstance,
  outboxQueueName,
} from '../outbox-event-handler.js';
import { OutboxHandlerRegistry } from '../outbox-handler-registry.js';

@Injectable()
@OutboxEventHandler({ name: 'notify-project', events: ['ProjectCreated', 'ProjectArchived'] })
class NotifyProject implements OutboxEventHandlerInstance {
  handle() {
    return Promise.resolve();
  }
}

@Injectable()
@OutboxEventHandler({ name: 'refresh-summary', events: ['ProjectCreated'] })
class RefreshSummary implements OutboxEventHandlerInstance {
  handle() {
    return Promise.resolve();
  }
}

@Injectable()
class NotAHandler {}

async function registryFor(providers: (new (...args: never[]) => unknown)[]) {
  @Module({ providers })
  class HandlersModule {}
  const moduleRef = await Test.createTestingModule({
    imports: [DiscoveryModule, HandlersModule],
    providers: [OutboxHandlerRegistry],
  }).compile();
  await moduleRef.init();
  return moduleRef.get(OutboxHandlerRegistry);
}

describe('OutboxHandlerRegistry', () => {
  it('discovers decorated providers and routes by event type', async () => {
    const registry = await registryFor([NotifyProject, RefreshSummary, NotAHandler]);
    expect(registry.all().map((h) => h.name)).toEqual(['notify-project', 'refresh-summary']);
    expect(registry.handlerNamesFor('ProjectCreated')).toEqual([
      'notify-project',
      'refresh-summary',
    ]);
    expect(registry.handlerNamesFor('ProjectArchived')).toEqual(['notify-project']);
    expect(registry.handlerNamesFor('Unknown')).toEqual([]);
    expect(registry.get('notify-project')?.instance).toBeInstanceOf(NotifyProject);
  });

  it('refuses two handlers with the same name', async () => {
    @Injectable()
    @OutboxEventHandler({ name: 'notify-project', events: ['ProjectArchived'] })
    class Duplicate {}
    await expect(registryFor([NotifyProject, Duplicate])).rejects.toThrow(
      /Duplicate outbox handler/,
    );
  });

  it('refuses event types that are not PascalCase', async () => {
    @Injectable()
    @OutboxEventHandler({ name: 'bad-events', events: ['project.created'] })
    class BadEvents {}
    await expect(registryFor([BadEvents])).rejects.toThrow(TypeError);
  });
});

describe('@OutboxEventHandler', () => {
  it('validates the handler name and requires at least one event', () => {
    expect(() => OutboxEventHandler({ name: 'Bad Name', events: ['ProjectCreated'] })).toThrow(
      TypeError,
    );
    expect(() => OutboxEventHandler({ name: 'no-events', events: [] })).toThrow(TypeError);
  });

  it('maps a handler to its pg-boss queue', () => {
    expect(outboxQueueName('notify-project')).toBe('outbox.notify-project');
  });
});
