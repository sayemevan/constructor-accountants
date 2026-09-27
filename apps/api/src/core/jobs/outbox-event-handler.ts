import 'reflect-metadata';

import type { OutboxEventEnvelope } from '../outbox/index.js';

export interface OutboxEventHandlerOptions {
  /** Unique, stable handler name; also its pg-boss queue (`outbox.<name>`) and the dedupe key with the eventId. */
  readonly name: string;
  /** The event types it handles. */
  readonly events: readonly string[];
}

/** An outbox event handler (25): idempotent, runs in the worker inside the event's tenant context. */
export interface OutboxEventHandlerInstance {
  handle(event: OutboxEventEnvelope): Promise<void>;
}

export const OUTBOX_EVENT_HANDLER = Symbol('OUTBOX_EVENT_HANDLER');

const HANDLER_NAME = /^[a-z][a-z0-9-]{1,62}$/;

/**
 * Marks a provider as an outbox event handler. Put handlers in the consuming module's `events/` folder and list
 * them as providers of that module; the worker discovers them at startup.
 * ```ts
 * @Injectable()
 * @OutboxEventHandler({ name: 'notify-project-created', events: ['ProjectCreated'] })
 * export class NotifyProjectCreatedHandler implements OutboxEventHandlerInstance { … }
 * ```
 */
export function OutboxEventHandler(options: OutboxEventHandlerOptions): ClassDecorator {
  if (!HANDLER_NAME.test(options.name)) {
    throw new TypeError(`Invalid outbox handler name "${options.name}": kebab-case, 2–63 chars`);
  }
  if (options.events.length === 0) {
    throw new TypeError(`Outbox handler "${options.name}" handles no events`);
  }
  return (target) => {
    Reflect.defineMetadata(OUTBOX_EVENT_HANDLER, options, target);
  };
}

/** The pg-boss queue of a handler. */
export function outboxQueueName(handlerName: string): string {
  return `outbox.${handlerName}`;
}

/** Where handler jobs go after their last retry. Its worker logs them as errors (alert). */
export const OUTBOX_DEAD_LETTER_QUEUE = 'outbox.dead-letter';
