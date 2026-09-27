'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { makeQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: ReactNode }): ReactNode {
  // One client per browser session; created lazily so server renders never share a cache between requests.
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
