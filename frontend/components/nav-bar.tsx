'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/pages', label: 'Pages' },
];

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function getDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function detectPreset(from: string | null, to: string | null): number {
  if (!from || !to) return 7;
  const diffMs = new Date(to).getTime() - new Date(from).getTime();
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const match = PRESETS.find((p) => p.days === days);
  return match?.days ?? 7;
}

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const currentDays = detectPreset(searchParams.get('from'), searchParams.get('to'));

  function handlePresetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const days = Number(e.target.value);
    const { from, to } = getDateRange(days);
    router.push(`/dashboard?from=${from}&to=${to}`);
  }

  function handleSignOut() {
    localStorage.removeItem('token');
    // Drop all cached data so the next account can't see this one's insights
    queryClient.clear();
    router.push('/login');
  }

  return (
    <nav className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-6 shrink-0">
      <Link href="/dashboard" className="font-bold text-gray-900 text-sm">
        📊 MarketingTool
      </Link>
      {NAV_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium pb-0.5 ${
              isActive
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <div className="ml-auto flex items-center gap-3">
        {pathname === '/dashboard' && (
          <select
            value={currentDays}
            onChange={handlePresetChange}
            className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {PRESETS.map((p) => (
              <option key={p.days} value={p.days}>
                {p.label}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
