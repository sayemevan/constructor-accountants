import { z } from 'zod';

/** `GET /api/health/live` and `GET /api/health/ready` success body. Failures use the error envelope (503). */
export const HealthResponse = z.object({
  status: z.literal('ok'),
  checks: z.record(z.string(), z.literal('up')).optional(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
