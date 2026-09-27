import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Production serves web and API from one origin via the reverse proxy (/api/* → api). In `next dev` there is
  // no proxy, so forward /api/* to the local API to keep the browser same-origin (cookies, CSRF header).
  rewrites() {
    if (process.env.NODE_ENV !== 'development') return Promise.resolve([]);
    const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }]);
  },
};

export default nextConfig;
