import { LayoutDashboard } from 'lucide-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage(): ReactNode {
  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your projects, dues and alerts." />
      <EmptyState
        icon={LayoutDashboard}
        title="Nothing here yet"
        description="Project, finance and workforce summaries will appear here once those modules are set up."
      />
    </>
  );
}
