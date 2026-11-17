export const READ = { readOnlyHint: true } as const;
export const WRITE = { readOnlyHint: false, destructiveHint: false } as const;
export const IDEMPOTENT = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true } as const;
