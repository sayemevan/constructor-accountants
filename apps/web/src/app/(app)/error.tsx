'use client';

import type { ReactNode } from 'react';

import { ErrorState } from '@/components/common/error-state';

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}): ReactNode {
  return <ErrorState error={error} onRetry={retry} />;
}
