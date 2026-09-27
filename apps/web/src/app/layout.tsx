import { cn } from 'cn';
import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';
import { Providers } from './providers';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_APP_NAME ?? 'Construction ERP',
    template: `%s · ${process.env.NEXT_PUBLIC_APP_NAME ?? 'Construction ERP'}`,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the mobile bottom nav pad itself with env(safe-area-inset-bottom).
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en" className={cn('font-sans antialiased', geist.variable)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
