import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  /** Primary action — pass only when the user has permission to perform it. */
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: EmptyStateProps): ReactNode {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center">
      <Icon aria-hidden className="mb-3 size-10 text-muted-foreground" />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
