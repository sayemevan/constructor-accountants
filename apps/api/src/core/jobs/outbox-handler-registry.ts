import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { assertEventType } from '../outbox/index.js';
import {
  OUTBOX_EVENT_HANDLER,
  type OutboxEventHandlerInstance,
  type OutboxEventHandlerOptions,
} from './outbox-event-handler.js';

export interface RegisteredOutboxHandler {
  readonly name: string;
  readonly events: readonly string[];
  readonly instance: OutboxEventHandlerInstance;
}

/** Every `@OutboxEventHandler` provider of the application, found at startup. */
@Injectable()
export class OutboxHandlerRegistry implements OnModuleInit {
  private handlers: readonly RegisteredOutboxHandler[] = [];

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): void {
    const found: RegisteredOutboxHandler[] = [];
    for (const wrapper of this.discovery.getProviders()) {
      const metatype: unknown = wrapper.metatype;
      const instance: unknown = wrapper.instance;
      if (typeof metatype !== 'function' || instance === undefined || instance === null) continue;
      const options = Reflect.getMetadata(OUTBOX_EVENT_HANDLER, metatype) as
        OutboxEventHandlerOptions | undefined;
      if (options === undefined) continue;
      found.push({
        name: options.name,
        events: options.events,
        instance: instance as OutboxEventHandlerInstance,
      });
    }
    this.handlers = validate(found);
  }

  all(): readonly RegisteredOutboxHandler[] {
    return this.handlers;
  }

  /** Names of the handlers of `eventType`. */
  handlerNamesFor(eventType: string): readonly string[] {
    return this.handlers.filter((h) => h.events.includes(eventType)).map((h) => h.name);
  }

  get(name: string): RegisteredOutboxHandler | undefined {
    return this.handlers.find((h) => h.name === name);
  }
}

function validate(handlers: RegisteredOutboxHandler[]): RegisteredOutboxHandler[] {
  const names = new Set<string>();
  for (const handler of handlers) {
    if (names.has(handler.name)) {
      throw new Error(`Duplicate outbox handler name "${handler.name}"`);
    }
    names.add(handler.name);
    handler.events.forEach(assertEventType);
  }
  return handlers.sort((a, b) => a.name.localeCompare(b.name));
}
