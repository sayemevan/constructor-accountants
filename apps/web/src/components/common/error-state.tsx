'use client';

import { RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { describeError } from '@/lib/describe-error';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
}

/** Error view for any failed data view or route segment. Never renders raw error bodies. */
export function ErrorState({ error, onRetry }: ErrorStateProps): ReactNode {
  const { title, message, reference, retryable } = describeError(error);
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-xl border px-6 py-12 text-center"
    >
      <TriangleAlert aria-hidden className="mb-3 size-10 text-destructive" />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {reference && (
        <p className="mt-2 text-xs text-muted-foreground">
          Reference: <span className="font-mono select-all">{reference}</span>
        </p>
      )}
      {retryable && onRetry && (
        <Button variant="outline" className="mt-4 min-h-11" onClick={onRetry}>
          <RefreshCw aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}
