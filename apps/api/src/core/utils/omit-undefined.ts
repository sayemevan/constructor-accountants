/** `T` with `undefined` removed from optional properties (required ones are unchanged). */
export type OmitUndefined<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
};

/**
 * Drops properties whose value is `undefined`. Zod infers optional fields as `T | undefined`, while Prisma inputs
 * (under `exactOptionalPropertyTypes`) and "keep the current value" merges need the key to be absent instead.
 * `null` is kept: it means "clear this field".
 */
export function omitUndefined<T extends object>(value: T): OmitUndefined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as OmitUndefined<T>;
}
