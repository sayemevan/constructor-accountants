import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';

// Session validation (GET /api/v1/auth/session via API_INTERNAL_URL, redirect to /login) is added with the auth module.
export default function AppLayout({ children }: { children: ReactNode }): ReactNode {
  return <AppShell>{children}</AppShell>;
}
