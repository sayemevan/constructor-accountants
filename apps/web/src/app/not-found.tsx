import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFound(): ReactNode {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page may have moved, or the link is incorrect."
        action={
          <Button asChild className="min-h-11">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        }
      />
    </main>
  );
}
