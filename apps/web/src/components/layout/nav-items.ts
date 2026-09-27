import {
  Banknote,
  Bell,
  CalendarCheck,
  Camera,
  ChartColumn,
  FolderKanban,
  Handshake,
  HardHat,
  Landmark,
  LayoutDashboard,
  Settings,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Items will be filtered by permission (`can()`) once auth lands; the routes are added with their modules.

/** Full navigation: desktop sidebar and the mobile "More" sheet. */
export const MAIN_NAV: readonly NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Parties', href: '/parties', icon: Handshake },
  { label: 'Employees', href: '/employees', icon: HardHat },
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
  { label: 'Payroll', href: '/payroll', icon: Wallet },
  { label: 'Finance', href: '/finance', icon: Landmark },
  { label: 'Reports', href: '/reports', icon: ChartColumn },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/** Mobile bottom bar: field actions first (ai-context/11-frontend-standards.md → Responsive). */
export const FIELD_NAV: readonly NavItem[] = [
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck },
  { label: 'Photo', href: '/documents/photos', icon: Camera },
  { label: 'Payment', href: '/finance/payments', icon: Banknote },
  { label: 'Alerts', href: '/notifications', icon: Bell },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
