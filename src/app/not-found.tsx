import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#0c0c0e] text-zinc-900 dark:text-zinc-100 font-sans">
      <div className="text-center max-w-md px-6">
        <p className="text-4xl font-bold text-amber-500 mb-2">404</p>
        <h1 className="text-lg font-semibold mb-2">Page not found</h1>
        <p className="text-sm text-zinc-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
