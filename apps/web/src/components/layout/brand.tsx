import { Construction } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Brand(): ReactNode {
  return (
    <Link
      href="/dashboard"
      className="flex min-h-11 items-center gap-2 rounded-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Construction aria-hidden className="size-6" />
      <span>{process.env.NEXT_PUBLIC_APP_NAME ?? 'Construction ERP'}</span>
    </Link>
  );
}
