import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as reachable without a session. Every endpoint must declare either `@Public()` or
 * `@RequirePermission(...)` (deny by default — 09-authorization-rules.md). The guards that read this arrive in Phase 1.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
